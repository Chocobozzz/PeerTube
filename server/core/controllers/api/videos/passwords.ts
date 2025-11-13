import { HttpStatusCode, VideoChannelActivityAction } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import express from 'express'
import { Transaction } from 'sequelize'
import { getFormattedObjects } from '../../../helpers/utils.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares/index.js'
import {
  addVideoPasswordValidator,
  listVideoPasswordValidator,
  paginationValidator,
  removeVideoPasswordValidator,
  updateVideoPasswordListValidator,
  videoPasswordsSortValidator
} from '../../../middlewares/validators/index.js'

const lTags = loggerTagsFactory('api', 'video')
const videoPasswordRouter = express.Router()

videoPasswordRouter.get(
  '/:videoId/passwords',
  authenticate,
  paginationValidator,
  videoPasswordsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoPasswordValidator),
  asyncMiddleware(listVideoPasswords)
)

videoPasswordRouter.put(
  '/:videoId/passwords',
  authenticate,
  asyncMiddleware(updateVideoPasswordListValidator),
  asyncMiddleware(updateVideoPasswordList)
)

videoPasswordRouter.post('/:videoId/passwords', authenticate, asyncMiddleware(addVideoPasswordValidator), asyncMiddleware(addVideoPassword))

videoPasswordRouter.delete(
  '/:videoId/passwords/:passwordId',
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
  const video = res.locals.videoAll
  const videoId = video.id

  const passwordArray = req.body.passwords as string[]

  await VideoPasswordModel.sequelize.transaction(async (t: Transaction) => {
    await VideoPasswordModel.deleteAllPasswords(videoId, t)
    await VideoPasswordModel.addPasswords(passwordArray, videoId, t)

    await VideoChannelActivityModel.addVideoActivity({
      action: VideoChannelActivityAction.UPDATE_PASSWORDS,
      user: res.locals.oauth.token.User,
      channel: video.VideoChannel,
      video,
      transaction: t
    })
  })

  logger.info(`Video passwords for video with name ${video.name} and uuid ${video.uuid} have been updated`, lTags(video.uuid))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function addVideoPassword (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const videoId = video.id

  const newPassword = req.body.password as string

  await sequelizeTypescript.transaction(t => {
    return VideoPasswordModel.addPassword(newPassword, videoId, t)
  })

  logger.info(`Video password for video with name ${video.name} and uuid ${video.uuid} have been added`, lTags(video.uuid))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeVideoPassword (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const password = res.locals.videoPassword

  await VideoPasswordModel.deletePassword(password.id)

  await VideoChannelActivityModel.addVideoActivity({
    action: VideoChannelActivityAction.UPDATE_PASSWORDS,
    user: res.locals.oauth.token.User,
    channel: videoInstance.VideoChannel,
    video: videoInstance,
    transaction: null
  })

  logger.info(
    'Password with id %d of video named %s and uuid %s has been deleted.',
    password.id,
    videoInstance.name,
    videoInstance.uuid,
    lTags(videoInstance.uuid)
  )

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
