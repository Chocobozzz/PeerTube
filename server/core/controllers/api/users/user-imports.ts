import express from 'express'
import {
  asyncMiddleware,
  authenticate
} from '../../../middlewares/index.js'
import { setupUploadResumableRoutes } from '@server/lib/uploadx.js'
import {
  getLatestImportStatusValidator,
  userImportRequestResumableInitValidator,
  userImportRequestResumableValidator
} from '@server/middlewares/validators/users/user-import.js'
import { HttpStatusCode, UserImportState, UserImportUploadResult } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { UserImportModel } from '@server/models/user/user-import.js'
import { getFSUserImportFilePath } from '@server/lib/paths.js'
import { move } from 'fs-extra/esm'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'

const userImportRouter = express.Router()

userImportRouter.get('/:userId/imports/latest',
  authenticate,
  asyncMiddleware(getLatestImportStatusValidator),
  asyncMiddleware(getLatestImport)
)

setupUploadResumableRoutes({
  routePath: '/:userId/imports/import-resumable',
  router: userImportRouter,

  uploadInitAfterMiddlewares: [ asyncMiddleware(userImportRequestResumableInitValidator) ],

  uploadedMiddlewares: [ asyncMiddleware(userImportRequestResumableValidator) ],
  uploadedController: asyncMiddleware(addUserImportResumable)
})

// ---------------------------------------------------------------------------

export {
  userImportRouter
}

// ---------------------------------------------------------------------------

async function addUserImportResumable (req: express.Request, res: express.Response) {
  const file = res.locals.importUserFileResumable
  const user = res.locals.user

  // Move import
  const userImport = new UserImportModel({
    state: UserImportState.PENDING,
    userId: user.id,
    createdAt: new Date()
  })
  userImport.generateAndSetFilename()

  await move(file.path, getFSUserImportFilePath(userImport))

  await saveInTransactionWithRetries(userImport)

  // Create job
  await JobQueue.Instance.createJob({ type: 'import-user-archive', payload: { userImportId: userImport.id } })

  logger.info('User import request job created for user ' + user.username)

  return res.json({
    userImport: {
      id: userImport.id
    }
  } as UserImportUploadResult)
}

async function getLatestImport (req: express.Request, res: express.Response) {
  const userImport = await UserImportModel.loadLatestByUserId(res.locals.user.id)
  if (!userImport) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.json(userImport.toFormattedJSON())
}
