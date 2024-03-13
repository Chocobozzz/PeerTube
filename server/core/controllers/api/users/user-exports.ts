import express from 'express'
import { FileStorage, HttpStatusCode, UserExportRequest, UserExportRequestResult, UserExportState } from '@peertube/peertube-models'
import {
  asyncMiddleware,
  authenticate,
  userExportDeleteValidator,
  userExportRequestValidator,
  userExportsListValidator
} from '../../../middlewares/index.js'
import { UserExportModel } from '@server/models/user/user-export.js'
import { getFormattedObjects } from '@server/helpers/utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { CONFIG } from '@server/initializers/config.js'

const userExportsRouter = express.Router()

userExportsRouter.post('/:userId/exports/request',
  authenticate,
  asyncMiddleware(userExportRequestValidator),
  asyncMiddleware(requestExport)
)

userExportsRouter.get('/:userId/exports',
  authenticate,
  asyncMiddleware(userExportsListValidator),
  asyncMiddleware(listUserExports)
)

userExportsRouter.delete('/:userId/exports/:id',
  authenticate,
  asyncMiddleware(userExportDeleteValidator),
  asyncMiddleware(deleteUserExport)
)

// ---------------------------------------------------------------------------

export {
  userExportsRouter
}

// ---------------------------------------------------------------------------

async function requestExport (req: express.Request, res: express.Response) {
  const body = req.body as UserExportRequest

  const exportModel = new UserExportModel({
    state: UserExportState.PENDING,
    withVideoFiles: body.withVideoFiles,

    storage: CONFIG.OBJECT_STORAGE.ENABLED
      ? FileStorage.OBJECT_STORAGE
      : FileStorage.FILE_SYSTEM,

    userId: res.locals.user.id,
    createdAt: new Date()
  })
  exportModel.generateAndSetFilename()

  await sequelizeTypescript.transaction(async transaction => {
    await exportModel.save({ transaction })
  })

  await JobQueue.Instance.createJob({ type: 'create-user-export', payload: { userExportId: exportModel.id } })

  return res.json({
    export: {
      id: exportModel.id
    }
  } as UserExportRequestResult)
}

async function listUserExports (req: express.Request, res: express.Response) {
  const resultList = await UserExportModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    user: res.locals.user
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function deleteUserExport (req: express.Request, res: express.Response) {
  const userExport = res.locals.userExport

  await sequelizeTypescript.transaction(async transaction => {
    await userExport.reload({ transaction })

    if (!userExport.canBeSafelyRemoved()) {
      return res.sendStatus(HttpStatusCode.CONFLICT_409)
    }

    await userExport.destroy({ transaction })
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
