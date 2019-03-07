import * as express from 'express'
import { getFormattedObjects, getServerActor } from '../../helpers/utils'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { VideoChannelModel } from '../../models/video/video-channel'
import { videoPlaylistsSortValidator } from '../../middlewares/validators'
import { buildNSFWFilter, createReqFiles, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { CONFIG, MIMETYPES, sequelizeTypescript, THUMBNAILS_SIZE, VIDEO_PLAYLIST_PRIVACIES } from '../../initializers'
import { logger } from '../../helpers/logger'
import { resetSequelizeInstance } from '../../helpers/database-utils'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import {
  commonVideoPlaylistFiltersValidator,
  videoPlaylistsAddValidator,
  videoPlaylistsAddVideoValidator,
  videoPlaylistsDeleteValidator,
  videoPlaylistsGetValidator,
  videoPlaylistsReorderVideosValidator,
  videoPlaylistsUpdateOrRemoveVideoValidator,
  videoPlaylistsUpdateValidator
} from '../../middlewares/validators/videos/video-playlists'
import { VideoPlaylistCreate } from '../../../shared/models/videos/playlist/video-playlist-create.model'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { processImage } from '../../helpers/image-utils'
import { join } from 'path'
import { UserModel } from '../../models/account/user'
import { sendCreateVideoPlaylist, sendDeleteVideoPlaylist, sendUpdateVideoPlaylist } from '../../lib/activitypub/send'
import { getVideoPlaylistActivityPubUrl, getVideoPlaylistElementActivityPubUrl } from '../../lib/activitypub/url'
import { VideoPlaylistUpdate } from '../../../shared/models/videos/playlist/video-playlist-update.model'
import { VideoModel } from '../../models/video/video'
import { VideoPlaylistElementModel } from '../../models/video/video-playlist-element'
import { VideoPlaylistElementCreate } from '../../../shared/models/videos/playlist/video-playlist-element-create.model'
import { VideoPlaylistElementUpdate } from '../../../shared/models/videos/playlist/video-playlist-element-update.model'
import { copy, pathExists } from 'fs-extra'
import { AccountModel } from '../../models/account/account'

const reqThumbnailFile = createReqFiles([ 'thumbnailfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT, { thumbnailfile: CONFIG.STORAGE.TMP_DIR })

const videoPlaylistRouter = express.Router()

videoPlaylistRouter.get('/privacies', listVideoPlaylistPrivacies)

videoPlaylistRouter.get('/',
  paginationValidator,
  videoPlaylistsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideoPlaylistFiltersValidator,
  asyncMiddleware(listVideoPlaylists)
)

videoPlaylistRouter.get('/:playlistId',
  asyncMiddleware(videoPlaylistsGetValidator),
  getVideoPlaylist
)

videoPlaylistRouter.post('/',
  authenticate,
  reqThumbnailFile,
  asyncMiddleware(videoPlaylistsAddValidator),
  asyncRetryTransactionMiddleware(addVideoPlaylist)
)

videoPlaylistRouter.put('/:playlistId',
  authenticate,
  reqThumbnailFile,
  asyncMiddleware(videoPlaylistsUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideoPlaylist)
)

videoPlaylistRouter.delete('/:playlistId',
  authenticate,
  asyncMiddleware(videoPlaylistsDeleteValidator),
  asyncRetryTransactionMiddleware(removeVideoPlaylist)
)

videoPlaylistRouter.get('/:playlistId/videos',
  asyncMiddleware(videoPlaylistsGetValidator),
  paginationValidator,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(getVideoPlaylistVideos)
)

videoPlaylistRouter.post('/:playlistId/videos',
  authenticate,
  asyncMiddleware(videoPlaylistsAddVideoValidator),
  asyncRetryTransactionMiddleware(addVideoInPlaylist)
)

videoPlaylistRouter.post('/:playlistId/videos/reorder',
  authenticate,
  asyncMiddleware(videoPlaylistsReorderVideosValidator),
  asyncRetryTransactionMiddleware(reorderVideosPlaylist)
)

videoPlaylistRouter.put('/:playlistId/videos/:videoId',
  authenticate,
  asyncMiddleware(videoPlaylistsUpdateOrRemoveVideoValidator),
  asyncRetryTransactionMiddleware(updateVideoPlaylistElement)
)

videoPlaylistRouter.delete('/:playlistId/videos/:videoId',
  authenticate,
  asyncMiddleware(videoPlaylistsUpdateOrRemoveVideoValidator),
  asyncRetryTransactionMiddleware(removeVideoFromPlaylist)
)

// ---------------------------------------------------------------------------

export {
  videoPlaylistRouter
}

// ---------------------------------------------------------------------------

function listVideoPlaylistPrivacies (req: express.Request, res: express.Response) {
  res.json(VIDEO_PLAYLIST_PRIVACIES)
}

async function listVideoPlaylists (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const resultList = await VideoPlaylistModel.listForApi({
    followerActorId: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    type: req.query.type
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

function getVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylist = res.locals.videoPlaylist as VideoPlaylistModel

  return res.json(videoPlaylist.toFormattedJSON())
}

async function addVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInfo: VideoPlaylistCreate = req.body
  const user: UserModel = res.locals.oauth.token.User

  const videoPlaylist = new VideoPlaylistModel({
    name: videoPlaylistInfo.displayName,
    description: videoPlaylistInfo.description,
    privacy: videoPlaylistInfo.privacy || VideoPlaylistPrivacy.PRIVATE,
    ownerAccountId: user.Account.id
  })

  videoPlaylist.url = getVideoPlaylistActivityPubUrl(videoPlaylist) // We use the UUID, so set the URL after building the object

  if (videoPlaylistInfo.videoChannelId) {
    const videoChannel = res.locals.videoChannel as VideoChannelModel

    videoPlaylist.videoChannelId = videoChannel.id
    videoPlaylist.VideoChannel = videoChannel
  }

  const thumbnailField = req.files['thumbnailfile']
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[ 0 ]
    await processImage(thumbnailPhysicalFile, join(CONFIG.STORAGE.THUMBNAILS_DIR, videoPlaylist.getThumbnailName()), THUMBNAILS_SIZE)
  }

  const videoPlaylistCreated: VideoPlaylistModel = await sequelizeTypescript.transaction(async t => {
    const videoPlaylistCreated = await videoPlaylist.save({ transaction: t })

    // We need more attributes for the federation
    videoPlaylistCreated.OwnerAccount = await AccountModel.load(user.Account.id, t)
    await sendCreateVideoPlaylist(videoPlaylistCreated, t)

    return videoPlaylistCreated
  })

  logger.info('Video playlist with uuid %s created.', videoPlaylist.uuid)

  return res.json({
    videoPlaylist: {
      id: videoPlaylistCreated.id,
      uuid: videoPlaylistCreated.uuid
    }
  }).end()
}

async function updateVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInstance = res.locals.videoPlaylist as VideoPlaylistModel
  const videoPlaylistFieldsSave = videoPlaylistInstance.toJSON()
  const videoPlaylistInfoToUpdate = req.body as VideoPlaylistUpdate
  const wasPrivatePlaylist = videoPlaylistInstance.privacy === VideoPlaylistPrivacy.PRIVATE

  const thumbnailField = req.files['thumbnailfile']
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[ 0 ]
    await processImage(
      thumbnailPhysicalFile,
      join(CONFIG.STORAGE.THUMBNAILS_DIR, videoPlaylistInstance.getThumbnailName()),
      THUMBNAILS_SIZE
    )
  }

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoPlaylistInfoToUpdate.videoChannelId !== undefined) {
        if (videoPlaylistInfoToUpdate.videoChannelId === null) {
          videoPlaylistInstance.videoChannelId = null
        } else {
          const videoChannel = res.locals.videoChannel as VideoChannelModel

          videoPlaylistInstance.videoChannelId = videoChannel.id
          videoPlaylistInstance.VideoChannel = videoChannel
        }
      }

      if (videoPlaylistInfoToUpdate.displayName !== undefined) videoPlaylistInstance.name = videoPlaylistInfoToUpdate.displayName
      if (videoPlaylistInfoToUpdate.description !== undefined) videoPlaylistInstance.description = videoPlaylistInfoToUpdate.description

      if (videoPlaylistInfoToUpdate.privacy !== undefined) {
        videoPlaylistInstance.privacy = parseInt(videoPlaylistInfoToUpdate.privacy.toString(), 10)
      }

      const playlistUpdated = await videoPlaylistInstance.save(sequelizeOptions)

      const isNewPlaylist = wasPrivatePlaylist && playlistUpdated.privacy !== VideoPlaylistPrivacy.PRIVATE

      if (isNewPlaylist) {
        await sendCreateVideoPlaylist(playlistUpdated, t)
      } else {
        await sendUpdateVideoPlaylist(playlistUpdated, t)
      }

      logger.info('Video playlist %s updated.', videoPlaylistInstance.uuid)

      return playlistUpdated
    })
  } catch (err) {
    logger.debug('Cannot update the video playlist.', { err })

    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoPlaylistInstance, videoPlaylistFieldsSave)

    throw err
  }

  return res.type('json').status(204).end()
}

async function removeVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInstance: VideoPlaylistModel = res.locals.videoPlaylist

  await sequelizeTypescript.transaction(async t => {
    await videoPlaylistInstance.destroy({ transaction: t })

    await sendDeleteVideoPlaylist(videoPlaylistInstance, t)

    logger.info('Video playlist %s deleted.', videoPlaylistInstance.uuid)
  })

  return res.type('json').status(204).end()
}

async function addVideoInPlaylist (req: express.Request, res: express.Response) {
  const body: VideoPlaylistElementCreate = req.body
  const videoPlaylist: VideoPlaylistModel = res.locals.videoPlaylist
  const video: VideoModel = res.locals.video

  const playlistElement: VideoPlaylistElementModel = await sequelizeTypescript.transaction(async t => {
    const position = await VideoPlaylistElementModel.getNextPositionOf(videoPlaylist.id, t)

    const playlistElement = await VideoPlaylistElementModel.create({
      url: getVideoPlaylistElementActivityPubUrl(videoPlaylist, video),
      position,
      startTimestamp: body.startTimestamp || null,
      stopTimestamp: body.stopTimestamp || null,
      videoPlaylistId: videoPlaylist.id,
      videoId: video.id
    }, { transaction: t })

    videoPlaylist.updatedAt = new Date()
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)

    return playlistElement
  })

  // If the user did not set a thumbnail, automatically take the video thumbnail
  if (playlistElement.position === 1) {
    const playlistThumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, videoPlaylist.getThumbnailName())

    if (await pathExists(playlistThumbnailPath) === false) {
      logger.info('Generating default thumbnail to playlist %s.', videoPlaylist.url)

      const videoThumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName())
      await copy(videoThumbnailPath, playlistThumbnailPath)
    }
  }

  logger.info('Video added in playlist %s at position %d.', videoPlaylist.uuid, playlistElement.position)

  return res.json({
    videoPlaylistElement: {
      id: playlistElement.id
    }
  }).end()
}

async function updateVideoPlaylistElement (req: express.Request, res: express.Response) {
  const body: VideoPlaylistElementUpdate = req.body
  const videoPlaylist: VideoPlaylistModel = res.locals.videoPlaylist
  const videoPlaylistElement: VideoPlaylistElementModel = res.locals.videoPlaylistElement

  const playlistElement: VideoPlaylistElementModel = await sequelizeTypescript.transaction(async t => {
    if (body.startTimestamp !== undefined) videoPlaylistElement.startTimestamp = body.startTimestamp
    if (body.stopTimestamp !== undefined) videoPlaylistElement.stopTimestamp = body.stopTimestamp

    const element = await videoPlaylistElement.save({ transaction: t })

    videoPlaylist.updatedAt = new Date()
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)

    return element
  })

  logger.info('Element of position %d of playlist %s updated.', playlistElement.position, videoPlaylist.uuid)

  return res.type('json').status(204).end()
}

async function removeVideoFromPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistElement: VideoPlaylistElementModel = res.locals.videoPlaylistElement
  const videoPlaylist: VideoPlaylistModel = res.locals.videoPlaylist
  const positionToDelete = videoPlaylistElement.position

  await sequelizeTypescript.transaction(async t => {
    await videoPlaylistElement.destroy({ transaction: t })

    // Decrease position of the next elements
    await VideoPlaylistElementModel.increasePositionOf(videoPlaylist.id, positionToDelete, null, -1, t)

    videoPlaylist.updatedAt = new Date()
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)

    logger.info('Video playlist element %d of playlist %s deleted.', videoPlaylistElement.position, videoPlaylist.uuid)
  })

  return res.type('json').status(204).end()
}

async function reorderVideosPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylist: VideoPlaylistModel = res.locals.videoPlaylist

  const start: number = req.body.startPosition
  const insertAfter: number = req.body.insertAfterPosition
  const reorderLength: number = req.body.reorderLength || 1

  if (start === insertAfter) {
    return res.status(204).end()
  }

  // Example: if we reorder position 2 and insert after position 5 (so at position 6): # 1 2 3 4 5 6 7 8 9
  //  * increase position when position > 5 # 1 2 3 4 5 7 8 9 10
  //  * update position 2 -> position 6 # 1 3 4 5 6 7 8 9 10
  //  * decrease position when position position > 2 # 1 2 3 4 5 6 7 8 9
  await sequelizeTypescript.transaction(async t => {
    const newPosition = insertAfter + 1

    // Add space after the position when we want to insert our reordered elements (increase)
    await VideoPlaylistElementModel.increasePositionOf(videoPlaylist.id, newPosition, null, reorderLength, t)

    let oldPosition = start

    // We incremented the position of the elements we want to reorder
    if (start >= newPosition) oldPosition += reorderLength

    const endOldPosition = oldPosition + reorderLength - 1
    // Insert our reordered elements in their place (update)
    await VideoPlaylistElementModel.reassignPositionOf(videoPlaylist.id, oldPosition, endOldPosition, newPosition, t)

    // Decrease positions of elements after the old position of our ordered elements (decrease)
    await VideoPlaylistElementModel.increasePositionOf(videoPlaylist.id, oldPosition, null, -reorderLength, t)

    videoPlaylist.updatedAt = new Date()
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)
  })

  logger.info(
    'Reordered playlist %s (inserted after %d elements %d - %d).',
    videoPlaylist.uuid, insertAfter, start, start + reorderLength - 1
  )

  return res.type('json').status(204).end()
}

async function getVideoPlaylistVideos (req: express.Request, res: express.Response) {
  const videoPlaylistInstance: VideoPlaylistModel = res.locals.videoPlaylist
  const followerActorId = isUserAbleToSearchRemoteURI(res) ? null : undefined

  const resultList = await VideoModel.listForApi({
    followerActorId,
    start: req.query.start,
    count: req.query.count,
    sort: 'VideoPlaylistElements.position',
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    filter: req.query.filter,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    withFiles: false,
    videoPlaylistId: videoPlaylistInstance.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined
  })

  const additionalAttributes = { playlistInfo: true }
  return res.json(getFormattedObjects(resultList.data, resultList.total, { additionalAttributes }))
}
