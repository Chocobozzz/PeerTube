import { HttpStatusCode, UserImportState } from '@peertube/peertube-models'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { getFSUserImportFilePath } from '@server/lib/paths.js'
import { Redis } from '@server/lib/redis/index.js'
import { setupUploadResumableRoutes, userImportsUploadx } from '@server/lib/uploadx.js'
import {
  getLatestImportStatusValidator,
  userImportRequestResumableInitValidator,
  userImportRequestResumableValidator
} from '@server/middlewares/validators/users/user-import.js'
import { UserImportModel } from '@server/models/user/user-import.js'
import express from 'express'
import { move } from 'fs-extra/esm'
import { asyncMiddleware, authenticate } from '../../../middlewares/index.js'

const logger = createLogger()

const userImportRouter = express.Router()

registerUserImportSharedRoutes(userImportRouter)
registerUserImportResumableSharedRoutes(userImportRouter)

// ---------------------------------------------------------------------------

function registerUserImportSharedRoutes (router: express.Router) {
  router.get(
    '/:userId/imports/latest',
    authenticate,
    asyncMiddleware(getLatestImportStatusValidator),
    asyncMiddleware(getLatestImport)
  )
}

function registerUserImportResumableSharedRoutes (router: express.Router) {
  setupUploadResumableRoutes({
    routePath: '/:userId/imports/import-resumable',
    router,
    uploadxInstance: userImportsUploadx,

    initMetadataFields: [],

    uploadInitAfterMiddlewares: [ asyncMiddleware(userImportRequestResumableInitValidator) ],

    uploadedMiddlewares: [ asyncMiddleware(userImportRequestResumableValidator) ],
    uploadedController: asyncMiddleware(addUserImportResumable)
  })
}

// ---------------------------------------------------------------------------

export {
  // Will be used by parent router
  registerUserImportResumableSharedRoutes,
  registerUserImportSharedRoutes,
  userImportRouter
}

// ---------------------------------------------------------------------------

async function addUserImportResumable (req: express.Request, res: express.Response) {
  try {
    await doAddUserImportResumable(req, res)
  } finally {
    await Redis.Instance.deleteUploadSession(req.query.upload_id)
  }
}

async function doAddUserImportResumable (req: express.Request, res: express.Response) {
  const file = res.locals.importUserFileResumable
  const user = res.locals.user

  // Move import
  const userImport = new UserImportModel({
    state: UserImportState.PENDING,
    userId: user.id,
    createdAt: new Date()
  })
  userImport.generateAndSetFilename()

  if (!file.stagingKey) {
    await move(file.path, getFSUserImportFilePath(userImport))
  }

  await saveInTransactionWithRetries(userImport)

  // Create job
  await JobQueue.Instance.createJob({
    type: 'import-user-archive',
    payload: { userImportId: userImport.id, stagingKey: file.stagingKey }
  })

  logger.info('User import request job created for user ' + user.username)

  return res.json({
    userImport: {
      id: userImport.id
    }
  })
}

async function getLatestImport (req: express.Request, res: express.Response) {
  const userImport = await UserImportModel.loadLatestByUserId(res.locals.user.id)
  if (!userImport) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.json(userImport.toFormattedJSON())
}
