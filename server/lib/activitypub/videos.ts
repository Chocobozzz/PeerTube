import * as Bluebird from 'bluebird'
import { maxBy, minBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import { basename } from 'path'
import { Transaction } from 'sequelize/types'
import { TrackerModel } from '@server/models/server/tracker'
import { VideoLiveModel } from '@server/models/video/video-live'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import {
  ActivityHashTagObject,
  ActivityMagnetUrlObject,
  ActivityPlaylistSegmentHashesObject,
  ActivityPlaylistUrlObject,
  ActivitypubHttpFetcherPayload,
  ActivityTagObject,
  ActivityUrlObject,
  ActivityVideoUrlObject
} from '../../../shared/index'
import { ActivityTrackerUrlObject, VideoObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy } from '../../../shared/models/videos'
import { ThumbnailType } from '../../../shared/models/videos/thumbnail.type'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import { buildRemoteVideoBaseUrl, checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import {
  isAPVideoFileUrlMetadataObject,
  isAPVideoTrackerUrlObject,
  sanitizeAndCheckVideoTorrentObject
} from '../../helpers/custom-validators/activitypub/videos'
import { isArray } from '../../helpers/custom-validators/misc'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { deleteNonExistingModels, resetSequelizeInstance, retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doJSONRequest, PeerTubeRequestError } from '../../helpers/requests'
import { fetchVideoByUrl, getExtFromMimetype, VideoFetchByUrlType } from '../../helpers/video'
import {
  ACTIVITY_PUB,
  MIMETYPES,
  P2P_MEDIA_LOADER_PEER_VERSION,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  THUMBNAILS_SIZE
} from '../../initializers/constants'
import { sequelizeTypescript } from '../../initializers/database'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { VideoModel } from '../../models/video/video'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoShareModel } from '../../models/video/video-share'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist'
import {
  MAccountIdActor,
  MChannelAccountLight,
  MChannelDefault,
  MChannelId,
  MStreamingPlaylist,
  MStreamingPlaylistFilesVideo,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoAccountLight,
  MVideoAccountLightBlacklistAllFiles,
  MVideoAP,
  MVideoAPWithoutCaption,
  MVideoCaption,
  MVideoFile,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithHost
} from '../../types/models'
import { MThumbnail } from '../../types/models/video/thumbnail'
import { FilteredModelAttributes } from '../../types/sequelize'
import { ActorFollowScoreCache } from '../files-cache'
import { JobQueue } from '../job-queue'
import { Notifier } from '../notifier'
import { PeerTubeSocket } from '../peertube-socket'
import { createPlaceholderThumbnail, createVideoMiniatureFromUrl } from '../thumbnail'
import { setVideoTags } from '../video'
import { autoBlacklistVideoIfNeeded } from '../video-blacklist'
import { generateTorrentFileName } from '../video-paths'
import { getOrCreateActorAndServerAndModel } from './actor'
import { crawlCollectionPage } from './crawl'
import { sendCreateVideo, sendUpdateVideo } from './send'
import { addVideoShares, shareVideoByServerAndChannel } from './share'
import { addVideoComments } from './video-comments'
import { createRates } from './video-rates'

async function federateVideoIfNeeded (videoArg: MVideoAPWithoutCaption, isNewVideo: boolean, transaction?: Transaction) {
  const video = videoArg as MVideoAP

  if (
    // Check this is not a blacklisted video, or unfederated blacklisted video
    (video.isBlacklisted() === false || (isNewVideo === false && video.VideoBlacklist.unfederated === false)) &&
    // Check the video is public/unlisted and published
    video.hasPrivacyForFederation() && video.hasStateForFederation()
  ) {
    // Fetch more attributes that we will need to serialize in AP object
    if (isArray(video.VideoCaptions) === false) {
      video.VideoCaptions = await video.$get('VideoCaptions', {
        attributes: [ 'filename', 'language' ],
        transaction
      })
    }

    if (isNewVideo) {
      // Now we'll add the video's meta data to our followers
      await sendCreateVideo(video, transaction)
      await shareVideoByServerAndChannel(video, transaction)
    } else {
      await sendUpdateVideo(video, transaction)
    }
  }
}

async function fetchRemoteVideo (videoUrl: string): Promise<{ statusCode: number, videoObject: VideoObject }> {
  logger.info('Fetching remote video %s.', videoUrl)

  const { statusCode, body } = await doJSONRequest<any>(videoUrl, { activityPub: true })

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body })
    return { statusCode, videoObject: undefined }
  }

  return { statusCode, videoObject: body }
}

async function fetchRemoteVideoDescription (video: MVideoAccountLight) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = video.getDescriptionAPIPath()
  const url = REMOTE_SCHEME.HTTP + '://' + host + path

  const { body } = await doJSONRequest<any>(url)
  return body.description || ''
}

function getOrCreateVideoChannelFromVideoObject (videoObject: VideoObject) {
  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  if (checkUrlsSameHost(channel.id, videoObject.id) !== true) {
    throw new Error(`Video channel url ${channel.id} does not have the same host than video object id ${videoObject.id}`)
  }

  return getOrCreateActorAndServerAndModel(channel.id, 'all')
}

type SyncParam = {
  likes: boolean
  dislikes: boolean
  shares: boolean
  comments: boolean
  thumbnail: boolean
  refreshVideo?: boolean
}
async function syncVideoExternalAttributes (video: MVideo, fetchedVideo: VideoObject, syncParam: SyncParam) {
  logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid)

  const jobPayloads: ActivitypubHttpFetcherPayload[] = []

  if (syncParam.likes === true) {
    const handler = items => createRates(items, video, 'like')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'like' as 'like', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.likes, handler, cleaner)
      .catch(err => logger.error('Cannot add likes of video %s.', video.uuid, { err, rootUrl: fetchedVideo.likes }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.likes, videoId: video.id, type: 'video-likes' as 'video-likes' })
  }

  if (syncParam.dislikes === true) {
    const handler = items => createRates(items, video, 'dislike')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'dislike' as 'dislike', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.dislikes, handler, cleaner)
      .catch(err => logger.error('Cannot add dislikes of video %s.', video.uuid, { err, rootUrl: fetchedVideo.dislikes }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.dislikes, videoId: video.id, type: 'video-dislikes' as 'video-dislikes' })
  }

  if (syncParam.shares === true) {
    const handler = items => addVideoShares(items, video)
    const cleaner = crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.shares, handler, cleaner)
      .catch(err => logger.error('Cannot add shares of video %s.', video.uuid, { err, rootUrl: fetchedVideo.shares }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' as 'video-shares' })
  }

  if (syncParam.comments === true) {
    const handler = items => addVideoComments(items)
    const cleaner = crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.comments, handler, cleaner)
      .catch(err => logger.error('Cannot add comments of video %s.', video.uuid, { err, rootUrl: fetchedVideo.comments }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.comments, videoId: video.id, type: 'video-comments' as 'video-comments' })
  }

  await Bluebird.map(jobPayloads, payload => JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload }))
}

type GetVideoResult <T> = Promise<{
  video: T
  created: boolean
  autoBlacklisted?: boolean
}>

type GetVideoParamAll = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType?: 'all'
  allowRefresh?: boolean
}

type GetVideoParamImmutable = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType: 'only-immutable-attributes'
  allowRefresh: false
}

type GetVideoParamOther = {
  videoObject: { id: string } | string
  syncParam?: SyncParam
  fetchType?: 'all' | 'only-video'
  allowRefresh?: boolean
}

function getOrCreateVideoAndAccountAndChannel (options: GetVideoParamAll): GetVideoResult<MVideoAccountLightBlacklistAllFiles>
function getOrCreateVideoAndAccountAndChannel (options: GetVideoParamImmutable): GetVideoResult<MVideoImmutable>
function getOrCreateVideoAndAccountAndChannel (
  options: GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail>
async function getOrCreateVideoAndAccountAndChannel (
  options: GetVideoParamAll | GetVideoParamImmutable | GetVideoParamOther
): GetVideoResult<MVideoAccountLightBlacklistAllFiles | MVideoThumbnail | MVideoImmutable> {
  // Default params
  const syncParam = options.syncParam || { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)
  let videoFromDatabase = await fetchVideoByUrl(videoUrl, fetchType)

  if (videoFromDatabase) {
    // If allowRefresh is true, we could not call this function using 'only-immutable-attributes' fetch type
    if (allowRefresh === true && (videoFromDatabase as MVideoThumbnail).isOutdated()) {
      const refreshOptions = {
        video: videoFromDatabase as MVideoThumbnail,
        fetchedType: fetchType,
        syncParam
      }

      if (syncParam.refreshVideo === true) {
        videoFromDatabase = await refreshVideoIfNeeded(refreshOptions)
      } else {
        await JobQueue.Instance.createJobWithPromise({
          type: 'activitypub-refresher',
          payload: { type: 'video', url: videoFromDatabase.url }
        })
      }
    }

    return { video: videoFromDatabase, created: false }
  }

  const { videoObject: fetchedVideo } = await fetchRemoteVideo(videoUrl)
  if (!fetchedVideo) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  const actor = await getOrCreateVideoChannelFromVideoObject(fetchedVideo)
  const videoChannel = actor.VideoChannel

  try {
    const { autoBlacklisted, videoCreated } = await retryTransactionWrapper(createVideo, fetchedVideo, videoChannel, syncParam.thumbnail)

    await syncVideoExternalAttributes(videoCreated, fetchedVideo, syncParam)

    return { video: videoCreated, created: true, autoBlacklisted }
  } catch (err) {
    // Maybe a concurrent getOrCreateVideoAndAccountAndChannel call created this video
    if (err.name === 'SequelizeUniqueConstraintError') {
      const fallbackVideo = await fetchVideoByUrl(videoUrl, fetchType)
      if (fallbackVideo) return { video: fallbackVideo, created: false }
    }

    throw err
  }
}

async function updateVideoFromAP (options: {
  video: MVideoAccountLightBlacklistAllFiles
  videoObject: VideoObject
  account: MAccountIdActor
  channel: MChannelDefault
  overrideTo?: string[]
}) {
  const { video, videoObject, account, channel, overrideTo } = options

  logger.debug('Updating remote video "%s".', options.videoObject.uuid, { videoObject: options.videoObject, account, channel })

  let videoFieldsSave: any
  const wasPrivateVideo = video.privacy === VideoPrivacy.PRIVATE
  const wasUnlistedVideo = video.privacy === VideoPrivacy.UNLISTED

  try {
    let thumbnailModel: MThumbnail

    try {
      thumbnailModel = await createVideoMiniatureFromUrl({
        downloadUrl: getThumbnailFromIcons(videoObject).url,
        video,
        type: ThumbnailType.MINIATURE
      })
    } catch (err) {
      logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err })
    }

    const videoUpdated = await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = { transaction: t }

      videoFieldsSave = video.toJSON()

      // Check we can update the channel: we trust the remote server
      const oldVideoChannel = video.VideoChannel

      if (!oldVideoChannel.Actor.serverId || !channel.Actor.serverId) {
        throw new Error('Cannot check old channel/new channel validity because `serverId` is null')
      }

      if (oldVideoChannel.Actor.serverId !== channel.Actor.serverId) {
        throw new Error('New channel ' + channel.Actor.url + ' is not on the same server than new channel ' + oldVideoChannel.Actor.url)
      }

      const to = overrideTo || videoObject.to
      const videoData = await videoActivityObjectToDBAttributes(channel, videoObject, to)
      video.name = videoData.name
      video.uuid = videoData.uuid
      video.url = videoData.url
      video.category = videoData.category
      video.licence = videoData.licence
      video.language = videoData.language
      video.description = videoData.description
      video.support = videoData.support
      video.nsfw = videoData.nsfw
      video.commentsEnabled = videoData.commentsEnabled
      video.downloadEnabled = videoData.downloadEnabled
      video.waitTranscoding = videoData.waitTranscoding
      video.state = videoData.state
      video.duration = videoData.duration
      video.createdAt = videoData.createdAt
      video.publishedAt = videoData.publishedAt
      video.originallyPublishedAt = videoData.originallyPublishedAt
      video.privacy = videoData.privacy
      video.channelId = videoData.channelId
      video.views = videoData.views
      video.isLive = videoData.isLive

      // Ensures we update the updated video attribute
      video.changed('updatedAt', true)

      const videoUpdated = await video.save(sequelizeOptions) as MVideoFullLight

      if (thumbnailModel) await videoUpdated.addAndSaveThumbnail(thumbnailModel, t)

      const previewIcon = getPreviewFromIcons(videoObject)
      if (videoUpdated.getPreview() && previewIcon) {
        const previewModel = createPlaceholderThumbnail({
          fileUrl: previewIcon.url,
          video,
          type: ThumbnailType.PREVIEW,
          size: previewIcon
        })
        await videoUpdated.addAndSaveThumbnail(previewModel, t)
      }

      {
        const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoUpdated, videoObject.url)
        const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

        // Remove video files that do not exist anymore
        const destroyTasks = deleteNonExistingModels(videoUpdated.VideoFiles, newVideoFiles, t)
        await Promise.all(destroyTasks)

        // Update or add other one
        const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'video', t))
        videoUpdated.VideoFiles = await Promise.all(upsertTasks)
      }

      {
        const streamingPlaylistAttributes = streamingPlaylistActivityUrlToDBAttributes(videoUpdated, videoObject, videoUpdated.VideoFiles)
        const newStreamingPlaylists = streamingPlaylistAttributes.map(a => new VideoStreamingPlaylistModel(a))

        // Remove video playlists that do not exist anymore
        const destroyTasks = deleteNonExistingModels(videoUpdated.VideoStreamingPlaylists, newStreamingPlaylists, t)
        await Promise.all(destroyTasks)

        let oldStreamingPlaylistFiles: MVideoFile[] = []
        for (const videoStreamingPlaylist of videoUpdated.VideoStreamingPlaylists) {
          oldStreamingPlaylistFiles = oldStreamingPlaylistFiles.concat(videoStreamingPlaylist.VideoFiles)
        }

        videoUpdated.VideoStreamingPlaylists = []

        for (const playlistAttributes of streamingPlaylistAttributes) {
          const streamingPlaylistModel = await VideoStreamingPlaylistModel.upsert(playlistAttributes, { returning: true, transaction: t })
                                     .then(([ streamingPlaylist ]) => streamingPlaylist as MStreamingPlaylistFilesVideo)
          streamingPlaylistModel.Video = videoUpdated

          const newVideoFiles: MVideoFile[] = videoFileActivityUrlToDBAttributes(streamingPlaylistModel, playlistAttributes.tagAPObject)
            .map(a => new VideoFileModel(a))
          const destroyTasks = deleteNonExistingModels(oldStreamingPlaylistFiles, newVideoFiles, t)
          await Promise.all(destroyTasks)

          // Update or add other one
          const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'streaming-playlist', t))
          streamingPlaylistModel.VideoFiles = await Promise.all(upsertTasks)

          videoUpdated.VideoStreamingPlaylists.push(streamingPlaylistModel)
        }
      }

      {
        // Update Tags
        const tags = videoObject.tag
                                .filter(isAPHashTagObject)
                                .map(tag => tag.name)
        await setVideoTags({ video: videoUpdated, tags, transaction: t })
      }

      // Update trackers
      {
        const trackers = getTrackerUrls(videoObject, videoUpdated)
        await setVideoTrackers({ video: videoUpdated, trackers, transaction: t })
      }

      {
        // Update captions
        await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(videoUpdated.id, t)

        const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
          const caption = new VideoCaptionModel({
            videoId: videoUpdated.id,
            filename: VideoCaptionModel.generateCaptionName(c.identifier),
            language: c.identifier,
            fileUrl: c.url
          }) as MVideoCaption

          return VideoCaptionModel.insertOrReplaceLanguage(caption, t)
        })
        await Promise.all(videoCaptionsPromises)
      }

      {
        // Create or update existing live
        if (video.isLive) {
          const [ videoLive ] = await VideoLiveModel.upsert({
            saveReplay: videoObject.liveSaveReplay,
            permanentLive: videoObject.permanentLive,
            videoId: video.id
          }, { transaction: t, returning: true })

          videoUpdated.VideoLive = videoLive
        } else { // Delete existing live if it exists
          await VideoLiveModel.destroy({
            where: {
              videoId: video.id
            },
            transaction: t
          })

          videoUpdated.VideoLive = null
        }
      }

      return videoUpdated
    })

    await autoBlacklistVideoIfNeeded({
      video: videoUpdated,
      user: undefined,
      isRemote: true,
      isNew: false,
      transaction: undefined
    })

    // Notify our users?
    if (wasPrivateVideo || wasUnlistedVideo) Notifier.Instance.notifyOnNewVideoIfNeeded(videoUpdated)

    if (videoUpdated.isLive) {
      PeerTubeSocket.Instance.sendVideoLiveNewState(videoUpdated)
      PeerTubeSocket.Instance.sendVideoViewsUpdate(videoUpdated)
    }

    logger.info('Remote video with uuid %s updated', videoObject.uuid)

    return videoUpdated
  } catch (err) {
    if (video !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(video, videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err })
    throw err
  }
}

async function refreshVideoIfNeeded (options: {
  video: MVideoThumbnail
  fetchedType: VideoFetchByUrlType
  syncParam: SyncParam
}): Promise<MVideoThumbnail> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all'
    ? options.video as MVideoAccountLightBlacklistAllFiles
    : await VideoModel.loadByUrlAndPopulateAccount(options.video.url)

  try {
    const { videoObject } = await fetchRemoteVideo(video.url)

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video %s: invalid body.', video.url)

      await video.setAsRefreshed()
      return video
    }

    const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)

    const updateOptions = {
      video,
      videoObject,
      account: channelActor.VideoChannel.Account,
      channel: channelActor.VideoChannel
    }
    await retryTransactionWrapper(updateVideoFromAP, updateOptions)
    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    ActorFollowScoreCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

    return video
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Cannot refresh remote video %s: video does not exist anymore. Deleting it.', video.url)

      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    logger.warn('Cannot refresh video %s.', options.video.url, { err })

    ActorFollowScoreCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

    // Don't refresh in loop
    await video.setAsRefreshed()
    return video
  }
}

export {
  updateVideoFromAP,
  refreshVideoIfNeeded,
  federateVideoIfNeeded,
  fetchRemoteVideo,
  getOrCreateVideoAndAccountAndChannel,
  fetchRemoteVideoDescription,
  getOrCreateVideoChannelFromVideoObject
}

// ---------------------------------------------------------------------------

function isAPVideoUrlObject (url: any): url is ActivityVideoUrlObject {
  const urlMediaType = url.mediaType

  return MIMETYPES.VIDEO.MIMETYPE_EXT[urlMediaType] && urlMediaType.startsWith('video/')
}

function isAPStreamingPlaylistUrlObject (url: any): url is ActivityPlaylistUrlObject {
  return url && url.mediaType === 'application/x-mpegURL'
}

function isAPPlaylistSegmentHashesUrlObject (tag: any): tag is ActivityPlaylistSegmentHashesObject {
  return tag && tag.name === 'sha256' && tag.type === 'Link' && tag.mediaType === 'application/json'
}

function isAPMagnetUrlObject (url: any): url is ActivityMagnetUrlObject {
  return url && url.mediaType === 'application/x-bittorrent;x-scheme-handler/magnet'
}

function isAPHashTagObject (url: any): url is ActivityHashTagObject {
  return url && url.type === 'Hashtag'
}

async function createVideo (videoObject: VideoObject, channel: MChannelAccountLight, waitThumbnail = false) {
  logger.debug('Adding remote video %s.', videoObject.id)

  const videoData = await videoActivityObjectToDBAttributes(channel, videoObject, videoObject.to)
  const video = VideoModel.build(videoData) as MVideoThumbnail

  const promiseThumbnail = createVideoMiniatureFromUrl({
    downloadUrl: getThumbnailFromIcons(videoObject).url,
    video,
    type: ThumbnailType.MINIATURE
  }).catch(err => {
    logger.error('Cannot create miniature from url.', { err })
    return undefined
  })

  let thumbnailModel: MThumbnail
  if (waitThumbnail === true) {
    thumbnailModel = await promiseThumbnail
  }

  const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
    try {
      const sequelizeOptions = { transaction: t }

      const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight
      videoCreated.VideoChannel = channel

      if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)

      const previewIcon = getPreviewFromIcons(videoObject)
      if (previewIcon) {
        const previewModel = createPlaceholderThumbnail({
          fileUrl: previewIcon.url,
          video: videoCreated,
          type: ThumbnailType.PREVIEW,
          size: previewIcon
        })

        await videoCreated.addAndSaveThumbnail(previewModel, t)
      }

      // Process files
      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject.url)

      const videoFilePromises = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
      const videoFiles = await Promise.all(videoFilePromises)

      const streamingPlaylistsAttributes = streamingPlaylistActivityUrlToDBAttributes(videoCreated, videoObject, videoFiles)
      videoCreated.VideoStreamingPlaylists = []

      for (const playlistAttributes of streamingPlaylistsAttributes) {
        const playlist = await VideoStreamingPlaylistModel.create(playlistAttributes, { transaction: t }) as MStreamingPlaylistFilesVideo
        playlist.Video = videoCreated

        const playlistFiles = videoFileActivityUrlToDBAttributes(playlist, playlistAttributes.tagAPObject)
        const videoFilePromises = playlistFiles.map(f => VideoFileModel.create(f, { transaction: t }))
        playlist.VideoFiles = await Promise.all(videoFilePromises)

        videoCreated.VideoStreamingPlaylists.push(playlist)
      }

      // Process tags
      const tags = videoObject.tag
                              .filter(isAPHashTagObject)
                              .map(t => t.name)
      await setVideoTags({ video: videoCreated, tags, transaction: t })

      // Process captions
      const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
        const caption = new VideoCaptionModel({
          videoId: videoCreated.id,
          filename: VideoCaptionModel.generateCaptionName(c.identifier),
          language: c.identifier,
          fileUrl: c.url
        }) as MVideoCaption

        return VideoCaptionModel.insertOrReplaceLanguage(caption, t)
      })
      await Promise.all(videoCaptionsPromises)

      // Process trackers
      {
        const trackers = getTrackerUrls(videoObject, videoCreated)
        await setVideoTrackers({ video: videoCreated, trackers, transaction: t })
      }

      videoCreated.VideoFiles = videoFiles

      if (videoCreated.isLive) {
        const videoLive = new VideoLiveModel({
          streamKey: null,
          saveReplay: videoObject.liveSaveReplay,
          permanentLive: videoObject.permanentLive,
          videoId: videoCreated.id
        })

        videoCreated.VideoLive = await videoLive.save({ transaction: t })
      }

      const autoBlacklisted = await autoBlacklistVideoIfNeeded({
        video: videoCreated,
        user: undefined,
        isRemote: true,
        isNew: true,
        transaction: t
      })

      logger.info('Remote video with uuid %s inserted.', videoObject.uuid)

      return { autoBlacklisted, videoCreated }
    } catch (err) {
      // FIXME: Use rollback hook when https://github.com/sequelize/sequelize/pull/13038 is released
      // Remove thumbnail
      if (thumbnailModel) await thumbnailModel.removeThumbnail()

      throw err
    }
  })

  if (waitThumbnail === false) {
    // Error is already caught above
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promiseThumbnail.then(thumbnailModel => {
      if (!thumbnailModel) return

      thumbnailModel = videoCreated.id

      return thumbnailModel.save()
    })
  }

  return { autoBlacklisted, videoCreated }
}

function videoActivityObjectToDBAttributes (videoChannel: MChannelId, videoObject: VideoObject, to: string[] = []) {
  const privacy = to.includes(ACTIVITY_PUB.PUBLIC)
    ? VideoPrivacy.PUBLIC
    : VideoPrivacy.UNLISTED

  const duration = videoObject.duration.replace(/[^\d]+/, '')
  const language = videoObject.language?.identifier

  const category = videoObject.category
    ? parseInt(videoObject.category.identifier, 10)
    : undefined

  const licence = videoObject.licence
    ? parseInt(videoObject.licence.identifier, 10)
    : undefined

  const description = videoObject.content || null
  const support = videoObject.support || null

  return {
    name: videoObject.name,
    uuid: videoObject.uuid,
    url: videoObject.id,
    category,
    licence,
    language,
    description,
    support,
    nsfw: videoObject.sensitive,
    commentsEnabled: videoObject.commentsEnabled,
    downloadEnabled: videoObject.downloadEnabled,
    waitTranscoding: videoObject.waitTranscoding,
    isLive: videoObject.isLiveBroadcast,
    state: videoObject.state,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
    publishedAt: new Date(videoObject.published),

    originallyPublishedAt: videoObject.originallyPublishedAt
      ? new Date(videoObject.originallyPublishedAt)
      : null,

    updatedAt: new Date(videoObject.updated),
    views: videoObject.views,
    likes: 0,
    dislikes: 0,
    remote: true,
    privacy
  }
}

function videoFileActivityUrlToDBAttributes (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  urls: (ActivityTagObject | ActivityUrlObject)[]
) {
  const fileUrls = urls.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]

  if (fileUrls.length === 0) return []

  const attributes: FilteredModelAttributes<VideoFileModel>[] = []
  for (const fileUrl of fileUrls) {
    // Fetch associated magnet uri
    const magnet = urls.filter(isAPMagnetUrlObject)
                       .find(u => u.height === fileUrl.height)

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUtil.decode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) {
      throw new Error('Cannot parse magnet URI ' + magnet.href)
    }

    const torrentUrl = Array.isArray(parsed.xs)
      ? parsed.xs[0]
      : parsed.xs

    // Fetch associated metadata url, if any
    const metadata = urls.filter(isAPVideoFileUrlMetadataObject)
                         .find(u => {
                           return u.height === fileUrl.height &&
                             u.fps === fileUrl.fps &&
                             u.rel.includes(fileUrl.mediaType)
                         })

    const extname = getExtFromMimetype(MIMETYPES.VIDEO.MIMETYPE_EXT, fileUrl.mediaType)
    const resolution = fileUrl.height
    const videoId = (videoOrPlaylist as MStreamingPlaylist).playlistUrl ? null : videoOrPlaylist.id
    const videoStreamingPlaylistId = (videoOrPlaylist as MStreamingPlaylist).playlistUrl ? videoOrPlaylist.id : null

    const attribute = {
      extname,
      infoHash: parsed.infoHash,
      resolution,
      size: fileUrl.size,
      fps: fileUrl.fps || -1,
      metadataUrl: metadata?.href,

      // Use the name of the remote file because we don't proxify video file requests
      filename: basename(fileUrl.href),
      fileUrl: fileUrl.href,

      torrentUrl,
      // Use our own torrent name since we proxify torrent requests
      torrentFilename: generateTorrentFileName(videoOrPlaylist, resolution),

      // This is a video file owned by a video or by a streaming playlist
      videoId,
      videoStreamingPlaylistId
    }

    attributes.push(attribute)
  }

  return attributes
}

function streamingPlaylistActivityUrlToDBAttributes (video: MVideoId, videoObject: VideoObject, videoFiles: MVideoFile[]) {
  const playlistUrls = videoObject.url.filter(u => isAPStreamingPlaylistUrlObject(u)) as ActivityPlaylistUrlObject[]
  if (playlistUrls.length === 0) return []

  const attributes: (FilteredModelAttributes<VideoStreamingPlaylistModel> & { tagAPObject?: ActivityTagObject[] })[] = []
  for (const playlistUrlObject of playlistUrls) {
    const segmentsSha256UrlObject = playlistUrlObject.tag.find(isAPPlaylistSegmentHashesUrlObject)

    let files: unknown[] = playlistUrlObject.tag.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]

    // FIXME: backward compatibility introduced in v2.1.0
    if (files.length === 0) files = videoFiles

    if (!segmentsSha256UrlObject) {
      logger.warn('No segment sha256 URL found in AP playlist object.', { playlistUrl: playlistUrlObject })
      continue
    }

    const attribute = {
      type: VideoStreamingPlaylistType.HLS,
      playlistUrl: playlistUrlObject.href,
      segmentsSha256Url: segmentsSha256UrlObject.href,
      p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrlObject.href, files),
      p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
      videoId: video.id,
      tagAPObject: playlistUrlObject.tag
    }

    attributes.push(attribute)
  }

  return attributes
}

function getThumbnailFromIcons (videoObject: VideoObject) {
  let validIcons = videoObject.icon.filter(i => i.width > THUMBNAILS_SIZE.minWidth)
  // Fallback if there are not valid icons
  if (validIcons.length === 0) validIcons = videoObject.icon

  return minBy(validIcons, 'width')
}

function getPreviewFromIcons (videoObject: VideoObject) {
  const validIcons = videoObject.icon.filter(i => i.width > PREVIEWS_SIZE.minWidth)

  return maxBy(validIcons, 'width')
}

function getTrackerUrls (object: VideoObject, video: MVideoWithHost) {
  let wsFound = false

  const trackers = object.url.filter(u => isAPVideoTrackerUrlObject(u))
    .map((u: ActivityTrackerUrlObject) => {
      if (isArray(u.rel) && u.rel.includes('websocket')) wsFound = true

      return u.href
    })

  if (wsFound) return trackers

  return [
    buildRemoteVideoBaseUrl(video, '/tracker/socket', REMOTE_SCHEME.WS),
    buildRemoteVideoBaseUrl(video, '/tracker/announce')
  ]
}

async function setVideoTrackers (options: {
  video: MVideo
  trackers: string[]
  transaction?: Transaction
}) {
  const { video, trackers, transaction } = options

  const trackerInstances = await TrackerModel.findOrCreateTrackers(trackers, transaction)

  await video.$set('Trackers', trackerInstances, { transaction })
}
