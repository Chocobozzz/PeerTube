import { forceNumber } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  VideoChannelActivityAction,
  VideoPlaylistCreate,
  VideoPlaylistCreateResult,
  VideoPlaylistElementCreate,
  VideoPlaylistElementCreateResult,
  VideoPlaylistElementUpdate,
  VideoPlaylistPrivacy,
  VideoPlaylistPrivacyType,
  VideoPlaylistReorder,
  VideoPlaylistUpdate
} from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { scheduleRefreshIfNeeded } from '@server/lib/activitypub/playlists/index.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import {
  generateThumbnailForPlaylist,
  reorderPlaylistOrElementsPosition,
  sendPlaylistPositionUpdateOfChannel
} from '@server/lib/video-playlist.js'
import { getServerActor } from '@server/models/application/application.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { MVideoPlaylistFull, MVideoPlaylistThumbnail } from '@server/types/models/index.js'
import express from 'express'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../helpers/database-utils.js'
import { createReqFiles } from '../../helpers/express-utils.js'
import { logger } from '../../helpers/logger.js'
import { getFormattedObjects } from '../../helpers/utils.js'
import { MIMETYPES, VIDEO_PLAYLIST_PRIVACIES } from '../../initializers/constants.js'
import { sequelizeTypescript } from '../../initializers/database.js'
import { sendCreateVideoPlaylist, sendDeleteVideoPlaylist, sendUpdateVideoPlaylist } from '../../lib/activitypub/send/index.js'
import { getLocalVideoPlaylistActivityPubUrl, getLocalVideoPlaylistElementActivityPubUrl } from '../../lib/activitypub/url.js'
import { updateLocalPlaylistMiniatureFromExisting } from '../../lib/thumbnail.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares/index.js'
import { videoPlaylistsSortValidator } from '../../middlewares/validators/index.js'
import {
  commonVideoPlaylistFiltersValidator,
  videoPlaylistsAddValidator,
  videoPlaylistsAddVideoValidator,
  videoPlaylistsDeleteValidator,
  videoPlaylistsGetValidator,
  videoPlaylistsReorderVideosValidator,
  videoPlaylistsUpdateOrRemoveVideoValidator,
  videoPlaylistsUpdateValidator
} from '../../middlewares/validators/videos/video-playlists.js'
import { AccountModel } from '../../models/account/account.js'
import { VideoPlaylistElementModel } from '../../models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '../../models/video/video-playlist.js'

const reqThumbnailFile = createReqFiles([ 'thumbnailfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

const videoPlaylistRouter = express.Router()

videoPlaylistRouter.use(apiRateLimiter)

videoPlaylistRouter.get('/privacies', listVideoPlaylistPrivacies)

videoPlaylistRouter.get(
  '/',
  paginationValidator,
  videoPlaylistsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideoPlaylistFiltersValidator,
  asyncMiddleware(listVideoPlaylists)
)

videoPlaylistRouter.get('/:playlistId', asyncMiddleware(videoPlaylistsGetValidator('summary')), getVideoPlaylist)

videoPlaylistRouter.post(
  '/',
  authenticate,
  reqThumbnailFile,
  asyncMiddleware(videoPlaylistsAddValidator),
  asyncMiddleware(createVideoPlaylist)
)

videoPlaylistRouter.put(
  '/:playlistId',
  authenticate,
  reqThumbnailFile,
  asyncMiddleware(videoPlaylistsUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideoPlaylist)
)

videoPlaylistRouter.delete(
  '/:playlistId',
  authenticate,
  asyncMiddleware(videoPlaylistsDeleteValidator),
  asyncRetryTransactionMiddleware(removeVideoPlaylist)
)

// ---------------------------------------------------------------------------
// Playlist elements
// ---------------------------------------------------------------------------

videoPlaylistRouter.get(
  '/:playlistId/videos',
  asyncMiddleware(videoPlaylistsGetValidator('summary')),
  paginationValidator,
  setDefaultPagination,
  optionalAuthenticate,
  asyncMiddleware(listVideosOfPlaylist)
)

videoPlaylistRouter.post(
  '/:playlistId/videos',
  authenticate,
  asyncMiddleware(videoPlaylistsAddVideoValidator),
  asyncRetryTransactionMiddleware(addVideoInPlaylist)
)

videoPlaylistRouter.post(
  '/:playlistId/videos/reorder',
  authenticate,
  asyncMiddleware(videoPlaylistsReorderVideosValidator),
  asyncRetryTransactionMiddleware(reorderVideosOfPlaylist)
)

videoPlaylistRouter.put(
  '/:playlistId/videos/:playlistElementId',
  authenticate,
  asyncMiddleware(videoPlaylistsUpdateOrRemoveVideoValidator),
  asyncRetryTransactionMiddleware(updateVideoPlaylistElement)
)

videoPlaylistRouter.delete(
  '/:playlistId/videos/:playlistElementId',
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
    type: req.query.playlistType
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

function getVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylist = res.locals.videoPlaylistSummary

  scheduleRefreshIfNeeded(videoPlaylist)

  return res.json(videoPlaylist.toFormattedJSON())
}

async function createVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInfo: VideoPlaylistCreate = req.body
  const user = res.locals.oauth.token.User

  const videoPlaylist = new VideoPlaylistModel({
    name: videoPlaylistInfo.displayName,
    description: videoPlaylistInfo.description,
    privacy: videoPlaylistInfo.privacy || VideoPlaylistPrivacy.PRIVATE,
    ownerAccountId: res.locals.videoChannel?.Account.id ?? user.Account.id
  }) as MVideoPlaylistFull

  videoPlaylist.url = getLocalVideoPlaylistActivityPubUrl(videoPlaylist) // We use the UUID, so set the URL after building the object

  const videoChannel = res.locals.videoChannel

  if (videoChannel && videoPlaylistInfo.videoChannelId) {
    videoPlaylist.videoChannelId = videoChannel.id
    videoPlaylist.VideoChannel = videoChannel
  }

  const thumbnailField = req.files?.['thumbnailfile']
  const thumbnailModel = thumbnailField
    ? await updateLocalPlaylistMiniatureFromExisting({
      inputPath: thumbnailField[0].path,
      playlist: videoPlaylist,
      automaticallyGenerated: false
    })
    : undefined

  const videoPlaylistCreated = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      if (videoPlaylist.videoChannelId) {
        videoPlaylist.videoChannelPosition = await VideoPlaylistModel.getNextPositionOf({
          videoChannelId: videoPlaylist.videoChannelId,
          transaction: t
        })
      }

      const videoPlaylistCreated = await videoPlaylist.save({ transaction: t }) as MVideoPlaylistFull

      if (thumbnailModel) {
        await videoPlaylistCreated.setAndSaveThumbnail(thumbnailModel, t)
      }

      // We need more attributes for the federation
      videoPlaylistCreated.OwnerAccount = await AccountModel.load(user.Account.id, t)
      await sendCreateVideoPlaylist(videoPlaylistCreated, t)

      if (videoChannel) {
        await VideoChannelActivityModel.addPlaylistActivity({
          action: VideoChannelActivityAction.CREATE,
          user,
          channel: videoChannel,
          playlist: videoPlaylistCreated,
          transaction: t
        })
      }

      return videoPlaylistCreated
    })
  })

  logger.info('Video playlist with uuid %s created.', videoPlaylist.uuid)

  return res.json({
    videoPlaylist: {
      id: videoPlaylistCreated.id,
      shortUUID: uuidToShort(videoPlaylistCreated.uuid),
      uuid: videoPlaylistCreated.uuid
    } as VideoPlaylistCreateResult
  })
}

async function updateVideoPlaylist (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoPlaylistFull
  const body = req.body as VideoPlaylistUpdate

  const wasPrivatePlaylist = playlist.privacy === VideoPlaylistPrivacy.PRIVATE
  const wasNotPrivatePlaylist = playlist.privacy !== VideoPlaylistPrivacy.PRIVATE

  let removedFromChannel: { id: number, position: number }

  const thumbnailField = req.files?.['thumbnailfile']
  const thumbnailModel = thumbnailField
    ? await updateLocalPlaylistMiniatureFromExisting({
      inputPath: thumbnailField[0].path,
      playlist,
      automaticallyGenerated: false
    })
    : undefined

  try {
    await sequelizeTypescript.transaction(async t => {
      const newChannel = res.locals.videoChannel
      const user = res.locals.oauth.token.User

      // Had a channel, but the user changed it (to null or another channel)
      if (playlist.videoChannelId && body.videoChannelId !== undefined && body.videoChannelId !== playlist.videoChannelId) {
        await VideoChannelActivityModel.addPlaylistActivity({
          action: VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP,
          user,
          channel: playlist.VideoChannel,
          playlist,
          transaction: t
        })

        removedFromChannel = {
          id: playlist.videoChannelId,
          position: playlist.videoChannelPosition
        }

        playlist.videoChannelId = null
        playlist.VideoChannel = null
      }

      if (newChannel && newChannel.id !== playlist.videoChannelId) {
        await VideoChannelActivityModel.addPlaylistActivity({
          action: VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP,
          user,
          channel: newChannel,
          playlist,
          transaction: t
        })

        playlist.videoChannelPosition = await VideoPlaylistModel.getNextPositionOf({
          videoChannelId: newChannel.id,
          transaction: t
        })

        playlist.videoChannelId = newChannel.id
        playlist.VideoChannel = newChannel
      } else if (newChannel) {
        await VideoChannelActivityModel.addPlaylistActivity({
          action: VideoChannelActivityAction.UPDATE,
          user: res.locals.oauth.token.User,
          channel: newChannel,
          playlist,
          transaction: t
        })
      }

      if (body.displayName !== undefined) playlist.name = body.displayName
      if (body.description !== undefined) playlist.description = body.description

      if (body.privacy !== undefined) {
        playlist.privacy = forceNumber(body.privacy) as VideoPlaylistPrivacyType

        if (wasNotPrivatePlaylist === true && playlist.privacy === VideoPlaylistPrivacy.PRIVATE) {
          await sendDeleteVideoPlaylist(playlist, t)
        }
      }

      const playlistUpdated = await playlist.save({ transaction: t })

      if (thumbnailModel) {
        thumbnailModel.automaticallyGenerated = false
        await playlistUpdated.setAndSaveThumbnail(thumbnailModel, t)
      }

      const isNewPlaylist = wasPrivatePlaylist && playlistUpdated.privacy !== VideoPlaylistPrivacy.PRIVATE

      if (isNewPlaylist) {
        await sendCreateVideoPlaylist(playlistUpdated, t)
      } else {
        await sendUpdateVideoPlaylist(playlistUpdated, t)
      }

      if (removedFromChannel) {
        await VideoPlaylistModel.increasePositionOf({
          videoChannelId: removedFromChannel.id,
          fromPosition: removedFromChannel.position,
          by: -1,
          transaction: t
        })

        await sendPlaylistPositionUpdateOfChannel(removedFromChannel.id, t)
      }

      logger.info('Video playlist %s updated.', playlist.uuid)

      return playlistUpdated
    })
  } catch (err) {
    logger.debug('Cannot update the video playlist.', { err })

    // If the transaction is retried, sequelize will think the object has not changed
    // So we need to restore the previous fields
    await resetSequelizeInstance(playlist)

    throw err
  }

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeVideoPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInstance = res.locals.videoPlaylistSummary
  const positionToDelete = videoPlaylistInstance.videoChannelPosition

  await sequelizeTypescript.transaction(async t => {
    await videoPlaylistInstance.destroy({ transaction: t })

    if (videoPlaylistInstance.privacy !== VideoPlaylistPrivacy.PRIVATE) {
      await sendDeleteVideoPlaylist(videoPlaylistInstance, t)
    }

    if (videoPlaylistInstance.videoChannelId) {
      await VideoPlaylistModel.increasePositionOf({
        videoChannelId: videoPlaylistInstance.videoChannelId,
        fromPosition: positionToDelete,
        by: -1,
        transaction: t
      })
    }

    if (videoPlaylistInstance.videoChannelId) {
      await sendPlaylistPositionUpdateOfChannel(videoPlaylistInstance.videoChannelId, t)

      await VideoChannelActivityModel.addPlaylistActivity({
        action: VideoChannelActivityAction.DELETE,
        user: res.locals.oauth.token.User,
        channel: videoPlaylistInstance.VideoChannel,
        playlist: videoPlaylistInstance,
        transaction: t
      })
    }

    logger.info('Video playlist %s deleted.', videoPlaylistInstance.uuid)
  })

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

// ---------------------------------------------------------------------------
// Videos in playlist
// ---------------------------------------------------------------------------

async function addVideoInPlaylist (req: express.Request, res: express.Response) {
  const body: VideoPlaylistElementCreate = req.body
  const videoPlaylist = res.locals.videoPlaylistFull
  const video = res.locals.onlyVideo

  const playlistElement = await sequelizeTypescript.transaction(async t => {
    const position = await VideoPlaylistElementModel.getNextPositionOf(videoPlaylist.id, t)

    const playlistElement = await VideoPlaylistElementModel.create({
      position,
      startTimestamp: body.startTimestamp || null,
      stopTimestamp: body.stopTimestamp || null,
      videoPlaylistId: videoPlaylist.id,
      videoId: video.id
    }, { transaction: t })

    playlistElement.url = getLocalVideoPlaylistElementActivityPubUrl(videoPlaylist, playlistElement)
    await playlistElement.save({ transaction: t })

    videoPlaylist.changed('updatedAt', true)
    await videoPlaylist.save({ transaction: t })

    if (videoPlaylist.VideoChannel) {
      await VideoChannelActivityModel.addPlaylistActivity({
        action: VideoChannelActivityAction.UPDATE_ELEMENTS,
        user: res.locals.oauth.token.User,
        channel: videoPlaylist.VideoChannel,
        playlist: videoPlaylist,
        transaction: t
      })
    }

    return playlistElement
  })

  // If the user did not set a thumbnail, automatically take the video thumbnail
  if (videoPlaylist.shouldGenerateThumbnailWithNewElement(playlistElement)) {
    await generateThumbnailForPlaylist(videoPlaylist, video)
  }

  sendUpdateVideoPlaylist(videoPlaylist, undefined)
    .catch(err => logger.error('Cannot send video playlist update.', { err }))

  logger.info('Video added in playlist %s at position %d.', videoPlaylist.uuid, playlistElement.position)

  Hooks.runAction('action:api.video-playlist-element.created', { playlistElement, req, res })

  return res.json({
    videoPlaylistElement: {
      id: playlistElement.id
    } as VideoPlaylistElementCreateResult
  })
}

async function updateVideoPlaylistElement (req: express.Request, res: express.Response) {
  const body: VideoPlaylistElementUpdate = req.body
  const videoPlaylist = res.locals.videoPlaylistFull
  const videoPlaylistElement = res.locals.videoPlaylistElement

  const playlistElement: VideoPlaylistElementModel = await sequelizeTypescript.transaction(async t => {
    if (body.startTimestamp !== undefined) videoPlaylistElement.startTimestamp = body.startTimestamp
    if (body.stopTimestamp !== undefined) videoPlaylistElement.stopTimestamp = body.stopTimestamp

    const element = await videoPlaylistElement.save({ transaction: t })

    videoPlaylist.changed('updatedAt', true)
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)

    if (videoPlaylist.VideoChannel) {
      await VideoChannelActivityModel.addPlaylistActivity({
        action: VideoChannelActivityAction.UPDATE_ELEMENTS,
        user: res.locals.oauth.token.User,
        channel: videoPlaylist.VideoChannel,
        playlist: videoPlaylist,
        transaction: t
      })
    }

    return element
  })

  logger.info('Element of position %d of playlist %s updated.', playlistElement.position, videoPlaylist.uuid)

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeVideoFromPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistElement = res.locals.videoPlaylistElement
  const videoPlaylist = res.locals.videoPlaylistFull
  const positionToDelete = videoPlaylistElement.position

  await sequelizeTypescript.transaction(async t => {
    await videoPlaylistElement.destroy({ transaction: t })

    // Decrease position of the next elements
    await VideoPlaylistElementModel.increasePositionOf({
      videoPlaylistId: videoPlaylist.id,
      fromPosition: positionToDelete,
      by: -1,
      transaction: t
    })

    videoPlaylist.changed('updatedAt', true)
    await videoPlaylist.save({ transaction: t })

    if (videoPlaylist.VideoChannel) {
      await VideoChannelActivityModel.addPlaylistActivity({
        action: VideoChannelActivityAction.UPDATE_ELEMENTS,
        user: res.locals.oauth.token.User,
        channel: videoPlaylist.VideoChannel,
        playlist: videoPlaylist,
        transaction: t
      })
    }

    logger.info('Video playlist element %d of playlist %s deleted.', videoPlaylistElement.position, videoPlaylist.uuid)
  })

  // Do we need to regenerate the default thumbnail?
  if (positionToDelete === 1 && videoPlaylist.hasGeneratedThumbnail()) {
    await regeneratePlaylistThumbnail(videoPlaylist)
  }

  sendUpdateVideoPlaylist(videoPlaylist, undefined)
    .catch(err => logger.error('Cannot send video playlist update.', { err }))

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function reorderVideosOfPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylist = res.locals.videoPlaylistFull
  const body: VideoPlaylistReorder = req.body

  const start: number = body.startPosition
  const insertAfter: number = body.insertAfterPosition
  const reorderLength: number = body.reorderLength || 1

  if (start === insertAfter) {
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  }

  await sequelizeTypescript.transaction(async t => {
    await reorderPlaylistOrElementsPosition({
      model: VideoPlaylistElementModel,
      instance: videoPlaylist,
      start,
      insertAfter,
      reorderLength,
      transaction: t
    })

    videoPlaylist.changed('updatedAt', true)
    await videoPlaylist.save({ transaction: t })

    await sendUpdateVideoPlaylist(videoPlaylist, t)
  })

  // The first element changed
  if ((start === 1 || insertAfter === 0) && videoPlaylist.hasGeneratedThumbnail()) {
    await regeneratePlaylistThumbnail(videoPlaylist)
  }

  logger.info(
    'Reordered playlist %s (inserted after position %d elements %d - %d).',
    videoPlaylist.uuid,
    insertAfter,
    start,
    start + reorderLength - 1
  )

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function listVideosOfPlaylist (req: express.Request, res: express.Response) {
  const videoPlaylistInstance = res.locals.videoPlaylistSummary
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined
  const server = await getServerActor()

  const apiOptions = await Hooks.wrapObject({
    start: req.query.start,
    count: req.query.count,
    videoPlaylistId: videoPlaylistInstance.id,
    serverAccount: server.Account,
    user
  }, 'filter:api.video-playlist.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoPlaylistElementModel.listForApi.bind(VideoPlaylistElementModel),
    apiOptions,
    'filter:api.video-playlist.videos.list.result'
  )

  const options = { accountId: user?.Account?.id }
  return res.json(getFormattedObjects(resultList.data, resultList.total, options))
}

async function regeneratePlaylistThumbnail (videoPlaylist: MVideoPlaylistThumbnail) {
  await videoPlaylist.Thumbnail.destroy()
  videoPlaylist.Thumbnail = null

  const firstElement = await VideoPlaylistElementModel.loadFirstElementWithVideoThumbnail(videoPlaylist.id)
  if (firstElement) await generateThumbnailForPlaylist(videoPlaylist, firstElement.Video)
}
