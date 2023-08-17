import express from 'express'
import { Transaction } from 'sequelize'
import { HttpStatusCode } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { getVideoWithAttributes } from '@server/helpers/video.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares/index.js'
import {
  listVideoPasswordValidator,
  paginationValidator,
  removeVideoPasswordValidator,
  updateVideoPasswordListValidator,
  videoPasswordsSortValidator
} from '../../../middlewares/validators/index.js'

const lTags = loggerTagsFactory('api', 'video')
const videoPasswordRouter = express.Router()

videoPasswordRouter.get('/:videoId/passwords',
  authenticate,
  paginationValidator,
  videoPasswordsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoPasswordValidator),
  asyncMiddleware(listVideoPasswords)
)

videoPasswordRouter.put('/:videoId/passwords',
  authenticate,
  asyncMiddleware(updateVideoPasswordListValidator),
  asyncMiddleware(updateVideoPasswordList)
)

videoPasswordRouter.delete('/:videoId/passwords/:passwordId',
  authenticate,
  asyncMiddleware(removeVideoPasswordValidator),
  asyncRetryTransactionMiddleware(removeVideoPassword)
)

// ---------------------------------------------------------------------------

export {
  videoPasswordRouter
}

// ---------------------------------------------------------------------------

async function listVideoPasswords (req: express.Request, res: express.Response) {
  const options = {
    videoId: res.locals.videoAll.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  }

  const resultList = await VideoPasswordModel.listPasswords(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function updateVideoPasswordList (req: express.Request, res: express.Response) {
  const videoInstance = getVideoWithAttributes(res)
  const videoId = videoInstance.id

  const passwordArray = req.body.passwords as string[]

  await VideoPasswordModel.sequelize.transaction(async (t: Transaction) => {
    await VideoPasswordModel.deleteAllPasswords(videoId, t)
    await VideoPasswordModel.addPasswords(passwordArray, videoId, t)
  })

  logger.info(
    `Video passwords for video with name %s and uuid %s have been updated`,
    videoInstance.name,
    videoInstance.uuid,
    lTags(videoInstance.uuid)
  )

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeVideoPassword (req: express.Request, res: express.Response) {
  const videoInstance = getVideoWithAttributes(res)
  const password = res.locals.videoPassword

  await VideoPasswordModel.deletePassword(password.id)
  logger.info(
    'Password with id %d of video named %s and uuid %s has been deleted.',
    password.id,
    videoInstance.name,
    videoInstance.uuid,
    lTags(videoInstance.uuid)
  )

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
