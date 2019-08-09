import * as Bluebird from 'bluebird'
import * as sequelize from 'sequelize'
import * as magnetUtil from 'magnet-uri'
import * as request from 'request'
import {
  ActivityPlaylistSegmentHashesObject,
  ActivityPlaylistUrlObject,
  ActivityUrlObject,
  ActivityVideoUrlObject,
  VideoState
} from '../../../shared/index'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy } from '../../../shared/models/videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import {
  ACTIVITY_PUB,
  MIMETYPES,
  P2P_MEDIA_LOADER_PEER_VERSION,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  STATIC_PATHS
} from '../../initializers/constants'
import { ActorModel } from '../../models/activitypub/actor'
import { TagModel } from '../../models/video/tag'
import { VideoModel } from '../../models/video/video'
import { VideoFileModel } from '../../models/video/video-file'
import { getOrCreateActorAndServerAndModel } from './actor'
import { addVideoComments } from './video-comments'
import { crawlCollectionPage } from './crawl'
import { sendCreateVideo, sendUpdateVideo } from './send'
import { isArray } from '../../helpers/custom-validators/misc'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { JobQueue } from '../job-queue'
import { ActivitypubHttpFetcherPayload } from '../job-queue/handlers/activitypub-http-fetcher'
import { createRates } from './video-rates'
import { addVideoShares, shareVideoByServerAndChannel } from './share'
import { AccountModel } from '../../models/account/account'
import { fetchVideoByUrl, VideoFetchByUrlType } from '../../helpers/video'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { Notifier } from '../notifier'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { VideoShareModel } from '../../models/video/video-share'
import { VideoCommentModel } from '../../models/video/video-comment'
import { sequelizeTypescript } from '../../initializers/database'
import { createPlaceholderThumbnail, createVideoMiniatureFromUrl } from '../thumbnail'
import { ThumbnailModel } from '../../models/video/thumbnail'
import { ThumbnailType } from '../../../shared/models/videos/thumbnail.type'
import { join } from 'path'
import { FilteredModelAttributes } from '../../typings/sequelize'
import { autoBlacklistVideoIfNeeded } from '../video-blacklist'
import { ActorFollowScoreCache } from '../files-cache'
import { AccountModelIdActor, VideoChannelModelId, VideoChannelModelIdActor } from '../../typings/models'

async function federateVideoIfNeeded (video: VideoModel, isNewVideo: boolean, transaction?: sequelize.Transaction) {
  if (
    // Check this is not a blacklisted video, or unfederated blacklisted video
    (video.isBlacklisted() === false || (isNewVideo === false && video.VideoBlacklist.unfederated === false)) &&
    // Check the video is public/unlisted and published
    video.privacy !== VideoPrivacy.PRIVATE && video.state === VideoState.PUBLISHED
  ) {
    // Fetch more attributes that we will need to serialize in AP object
    if (isArray(video.VideoCaptions) === false) {
      video.VideoCaptions = await video.$get('VideoCaptions', {
        attributes: [ 'language' ],
        transaction
      }) as VideoCaptionModel[]
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

async function fetchRemoteVideo (videoUrl: string): Promise<{ response: request.RequestResponse, videoObject: VideoTorrentObject }> {
  const options = {
    uri: videoUrl,
    method: 'GET',
    json: true,
    activityPub: true
  }

  logger.info('Fetching remote video %s.', videoUrl)

  const { response, body } = await doRequest(options)

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body })
    return { response, videoObject: undefined }
  }

  return { response, videoObject: body }
}

async function fetchRemoteVideoDescription (video: VideoModel) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = video.getDescriptionAPIPath()
  const options = {
    uri: REMOTE_SCHEME.HTTP + '://' + host + path,
    json: true
  }

  const { body } = await doRequest(options)
  return body.description ? body.description : ''
}

function fetchRemoteVideoStaticFile (video: VideoModel, path: string, destPath: string) {
  const url = buildRemoteBaseUrl(video, path)

  // We need to provide a callback, if no we could have an uncaught exception
  return doRequestAndSaveToFile({ uri: url }, destPath)
}

function buildRemoteBaseUrl (video: VideoModel, path: string) {
  const host = video.VideoChannel.Account.Actor.Server.host

  return REMOTE_SCHEME.HTTP + '://' + host + path
}

function getOrCreateVideoChannelFromVideoObject (videoObject: VideoTorrentObject) {
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
async function syncVideoExternalAttributes (video: VideoModel, fetchedVideo: VideoTorrentObject, syncParam: SyncParam) {
  logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid)

  const jobPayloads: ActivitypubHttpFetcherPayload[] = []

  if (syncParam.likes === true) {
    const handler = items => createRates(items, video, 'like')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'like' as 'like', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.likes, handler, cleaner)
      .catch(err => logger.error('Cannot add likes of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.likes, videoId: video.id, type: 'video-likes' as 'video-likes' })
  }

  if (syncParam.dislikes === true) {
    const handler = items => createRates(items, video, 'dislike')
    const cleaner = crawlStartDate => AccountVideoRateModel.cleanOldRatesOf(video.id, 'dislike' as 'dislike', crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.dislikes, handler, cleaner)
      .catch(err => logger.error('Cannot add dislikes of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.dislikes, videoId: video.id, type: 'video-dislikes' as 'video-dislikes' })
  }

  if (syncParam.shares === true) {
    const handler = items => addVideoShares(items, video)
    const cleaner = crawlStartDate => VideoShareModel.cleanOldSharesOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.shares, handler, cleaner)
      .catch(err => logger.error('Cannot add shares of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' as 'video-shares' })
  }

  if (syncParam.comments === true) {
    const handler = items => addVideoComments(items)
    const cleaner = crawlStartDate => VideoCommentModel.cleanOldCommentsOf(video.id, crawlStartDate)

    await crawlCollectionPage<string>(fetchedVideo.comments, handler, cleaner)
      .catch(err => logger.error('Cannot add comments of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.comments, videoId: video.id, type: 'video-comments' as 'video-comments' })
  }

  await Bluebird.map(jobPayloads, payload => JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload }))
}

async function getOrCreateVideoAndAccountAndChannel (options: {
  videoObject: { id: string } | string,
  syncParam?: SyncParam,
  fetchType?: VideoFetchByUrlType,
  allowRefresh?: boolean // true by default
}) {
  // Default params
  const syncParam = options.syncParam || { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const allowRefresh = options.allowRefresh !== false

  // Get video url
  const videoUrl = getAPId(options.videoObject)

  let videoFromDatabase = await fetchVideoByUrl(videoUrl, fetchType)
  if (videoFromDatabase) {
    if (videoFromDatabase.isOutdated() && allowRefresh === true) {
      const refreshOptions = {
        video: videoFromDatabase,
        fetchedType: fetchType,
        syncParam
      }

      if (syncParam.refreshVideo === true) videoFromDatabase = await refreshVideoIfNeeded(refreshOptions)
      else await JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'video', url: videoFromDatabase.url } })
    }

    return { video: videoFromDatabase, created: false }
  }

  const { videoObject: fetchedVideo } = await fetchRemoteVideo(videoUrl)
  if (!fetchedVideo) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  const channelActor = await getOrCreateVideoChannelFromVideoObject(fetchedVideo)
  const { autoBlacklisted, videoCreated } = await retryTransactionWrapper(createVideo, fetchedVideo, channelActor, syncParam.thumbnail)

  await syncVideoExternalAttributes(videoCreated, fetchedVideo, syncParam)

  return { video: videoCreated, created: true, autoBlacklisted }
}

async function updateVideoFromAP (options: {
  video: VideoModel,
  videoObject: VideoTorrentObject,
  account: AccountModelIdActor,
  channel: VideoChannelModelIdActor,
  overrideTo?: string[]
}) {
  const { video, videoObject, account, channel, overrideTo } = options

  logger.debug('Updating remote video "%s".', options.videoObject.uuid)

  let videoFieldsSave: any
  const wasPrivateVideo = video.privacy === VideoPrivacy.PRIVATE
  const wasUnlistedVideo = video.privacy === VideoPrivacy.UNLISTED

  try {
    let thumbnailModel: ThumbnailModel

    try {
      thumbnailModel = await createVideoMiniatureFromUrl(videoObject.icon.url, video, ThumbnailType.MINIATURE)
    } catch (err) {
      logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err })
    }

    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = { transaction: t }

      videoFieldsSave = video.toJSON()

      // Check actor has the right to update the video
      const videoChannel = video.VideoChannel
      if (videoChannel.Account.id !== account.id) {
        throw new Error('Account ' + account.Actor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const to = overrideTo ? overrideTo : videoObject.to
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

      await video.save(sequelizeOptions)

      if (thumbnailModel) await video.addAndSaveThumbnail(thumbnailModel, t)

      // FIXME: use icon URL instead
      const previewUrl = buildRemoteBaseUrl(video, join(STATIC_PATHS.PREVIEWS, video.getPreview().filename))
      const previewModel = createPlaceholderThumbnail(previewUrl, video, ThumbnailType.PREVIEW, PREVIEWS_SIZE)
      await video.addAndSaveThumbnail(previewModel, t)

      {
        const videoFileAttributes = videoFileActivityUrlToDBAttributes(video, videoObject)
        const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

        // Remove video files that do not exist anymore
        const destroyTasks = video.VideoFiles
                                  .filter(f => !newVideoFiles.find(newFile => newFile.hasSameUniqueKeysThan(f)))
                                  .map(f => f.destroy(sequelizeOptions))
        await Promise.all(destroyTasks)

        // Update or add other one
        const upsertTasks = videoFileAttributes.map(a => {
          return VideoFileModel.upsert<VideoFileModel>(a, { returning: true, transaction: t })
            .then(([ file ]) => file)
        })

        video.VideoFiles = await Promise.all(upsertTasks)
      }

      {
        const streamingPlaylistAttributes = streamingPlaylistActivityUrlToDBAttributes(video, videoObject, video.VideoFiles)
        const newStreamingPlaylists = streamingPlaylistAttributes.map(a => new VideoStreamingPlaylistModel(a))

        // Remove video files that do not exist anymore
        const destroyTasks = video.VideoStreamingPlaylists
                                  .filter(f => !newStreamingPlaylists.find(newPlaylist => newPlaylist.hasSameUniqueKeysThan(f)))
                                  .map(f => f.destroy(sequelizeOptions))
        await Promise.all(destroyTasks)

        // Update or add other one
        const upsertTasks = streamingPlaylistAttributes.map(a => {
          return VideoStreamingPlaylistModel.upsert<VideoStreamingPlaylistModel>(a, { returning: true, transaction: t })
                               .then(([ streamingPlaylist ]) => streamingPlaylist)
        })

        video.VideoStreamingPlaylists = await Promise.all(upsertTasks)
      }

      {
        // Update Tags
        const tags = videoObject.tag.map(tag => tag.name)
        const tagInstances = await TagModel.findOrCreateTags(tags, t)
        await video.$set('Tags', tagInstances, sequelizeOptions)
      }

      {
        // Update captions
        await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(video.id, t)

        const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
          return VideoCaptionModel.insertOrReplaceLanguage(video.id, c.identifier, t)
        })
        video.VideoCaptions = await Promise.all(videoCaptionsPromises)
      }
    })

    await autoBlacklistVideoIfNeeded({
      video,
      user: undefined,
      isRemote: true,
      isNew: false,
      transaction: undefined
    })

    if (wasPrivateVideo || wasUnlistedVideo) Notifier.Instance.notifyOnNewVideoIfNeeded(video) // Notify our users?

    logger.info('Remote video with uuid %s updated', videoObject.uuid)
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
  video: VideoModel,
  fetchedType: VideoFetchByUrlType,
  syncParam: SyncParam
}): Promise<VideoModel> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all'
    ? options.video
    : await VideoModel.loadByUrlAndPopulateAccount(options.video.url)

  try {
    const { response, videoObject } = await fetchRemoteVideo(video.url)
    if (response.statusCode === 404) {
      logger.info('Cannot refresh remote video %s: video does not exist anymore. Deleting it.', video.url)

      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video %s: invalid body.', video.url)

      await video.setAsRefreshed()
      return video
    }

    const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)
    const account = await AccountModel.load(channelActor.VideoChannel.accountId)

    const updateOptions = {
      video,
      videoObject,
      account,
      channel: channelActor.VideoChannel
    }
    await retryTransactionWrapper(updateVideoFromAP, updateOptions)
    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    ActorFollowScoreCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

    return video
  } catch (err) {
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
  fetchRemoteVideoStaticFile,
  fetchRemoteVideoDescription,
  getOrCreateVideoChannelFromVideoObject
}

// ---------------------------------------------------------------------------

function isAPVideoUrlObject (url: ActivityUrlObject): url is ActivityVideoUrlObject {
  const mimeTypes = Object.keys(MIMETYPES.VIDEO.MIMETYPE_EXT)

  const urlMediaType = url.mediaType || url.mimeType
  return mimeTypes.indexOf(urlMediaType) !== -1 && urlMediaType.startsWith('video/')
}

function isAPStreamingPlaylistUrlObject (url: ActivityUrlObject): url is ActivityPlaylistUrlObject {
  const urlMediaType = url.mediaType || url.mimeType

  return urlMediaType === 'application/x-mpegURL'
}

function isAPPlaylistSegmentHashesUrlObject (tag: any): tag is ActivityPlaylistSegmentHashesObject {
  const urlMediaType = tag.mediaType || tag.mimeType

  return tag.name === 'sha256' && tag.type === 'Link' && urlMediaType === 'application/json'
}

async function createVideo (videoObject: VideoTorrentObject, channelActor: ActorModel, waitThumbnail = false) {
  logger.debug('Adding remote video %s.', videoObject.id)

  const videoData = await videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, videoObject.to)
  const video = VideoModel.build(videoData)

  const promiseThumbnail = createVideoMiniatureFromUrl(videoObject.icon.url, video, ThumbnailType.MINIATURE)

  let thumbnailModel: ThumbnailModel
  if (waitThumbnail === true) {
    thumbnailModel = await promiseThumbnail
  }

  const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions)
    videoCreated.VideoChannel = channelActor.VideoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)

    // FIXME: use icon URL instead
    const previewUrl = buildRemoteBaseUrl(videoCreated, join(STATIC_PATHS.PREVIEWS, video.generatePreviewName()))
    const previewModel = createPlaceholderThumbnail(previewUrl, video, ThumbnailType.PREVIEW, PREVIEWS_SIZE)
    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    // Process files
    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoObject.url)
    }

    const videoFilePromises = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
    const videoFiles = await Promise.all(videoFilePromises)

    const videoStreamingPlaylists = streamingPlaylistActivityUrlToDBAttributes(videoCreated, videoObject, videoFiles)
    const playlistPromises = videoStreamingPlaylists.map(p => VideoStreamingPlaylistModel.create(p, { transaction: t }))
    const streamingPlaylists = await Promise.all(playlistPromises)

    // Process tags
    const tags = videoObject.tag
                            .filter(t => t.type === 'Hashtag')
                            .map(t => t.name)
    const tagInstances = await TagModel.findOrCreateTags(tags, t)
    await videoCreated.$set('Tags', tagInstances, sequelizeOptions)

    // Process captions
    const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
      return VideoCaptionModel.insertOrReplaceLanguage(videoCreated.id, c.identifier, t)
    })
    const captions = await Promise.all(videoCaptionsPromises)

    video.VideoFiles = videoFiles
    video.VideoStreamingPlaylists = streamingPlaylists
    video.Tags = tagInstances
    video.VideoCaptions = captions

    const autoBlacklisted = await autoBlacklistVideoIfNeeded({
      video,
      user: undefined,
      isRemote: true,
      isNew: true,
      transaction: t
    })

    logger.info('Remote video with uuid %s inserted.', videoObject.uuid)

    return { autoBlacklisted, videoCreated }
  })

  if (waitThumbnail === false) {
    promiseThumbnail.then(thumbnailModel => {
      thumbnailModel = videoCreated.id

      return thumbnailModel.save()
    })
  }

  return { autoBlacklisted, videoCreated }
}

async function videoActivityObjectToDBAttributes (
  videoChannel: VideoChannelModelId,
  videoObject: VideoTorrentObject,
  to: string[] = []
) {
  const privacy = to.indexOf(ACTIVITY_PUB.PUBLIC) !== -1 ? VideoPrivacy.PUBLIC : VideoPrivacy.UNLISTED
  const duration = videoObject.duration.replace(/[^\d]+/, '')

  let language: string | undefined
  if (videoObject.language) {
    language = videoObject.language.identifier
  }

  let category: number | undefined
  if (videoObject.category) {
    category = parseInt(videoObject.category.identifier, 10)
  }

  let licence: number | undefined
  if (videoObject.licence) {
    licence = parseInt(videoObject.licence.identifier, 10)
  }

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
    state: videoObject.state,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
    publishedAt: new Date(videoObject.published),
    originallyPublishedAt: videoObject.originallyPublishedAt ? new Date(videoObject.originallyPublishedAt) : null,
    // FIXME: updatedAt does not seems to be considered by Sequelize
    updatedAt: new Date(videoObject.updated),
    views: videoObject.views,
    likes: 0,
    dislikes: 0,
    remote: true,
    privacy
  }
}

function videoFileActivityUrlToDBAttributes (video: VideoModel, videoObject: VideoTorrentObject) {
  const fileUrls = videoObject.url.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]

  if (fileUrls.length === 0) {
    throw new Error('Cannot find video files for ' + video.url)
  }

  const attributes: FilteredModelAttributes<VideoFileModel>[] = []
  for (const fileUrl of fileUrls) {
    // Fetch associated magnet uri
    const magnet = videoObject.url.find(u => {
      const mediaType = u.mediaType || u.mimeType
      return mediaType === 'application/x-bittorrent;x-scheme-handler/magnet' && (u as any).height === fileUrl.height
    })

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUtil.decode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) {
      throw new Error('Cannot parse magnet URI ' + magnet.href)
    }

    const mediaType = fileUrl.mediaType || fileUrl.mimeType
    const attribute = {
      extname: MIMETYPES.VIDEO.MIMETYPE_EXT[ mediaType ],
      infoHash: parsed.infoHash,
      resolution: fileUrl.height,
      size: fileUrl.size,
      videoId: video.id,
      fps: fileUrl.fps || -1
    }

    attributes.push(attribute)
  }

  return attributes
}

function streamingPlaylistActivityUrlToDBAttributes (video: VideoModel, videoObject: VideoTorrentObject, videoFiles: VideoFileModel[]) {
  const playlistUrls = videoObject.url.filter(u => isAPStreamingPlaylistUrlObject(u)) as ActivityPlaylistUrlObject[]
  if (playlistUrls.length === 0) return []

  const attributes: FilteredModelAttributes<VideoStreamingPlaylistModel>[] = []
  for (const playlistUrlObject of playlistUrls) {
    const segmentsSha256UrlObject = playlistUrlObject.tag
                                                     .find(t => {
                                                       return isAPPlaylistSegmentHashesUrlObject(t)
                                                     }) as ActivityPlaylistSegmentHashesObject
    if (!segmentsSha256UrlObject) {
      logger.warn('No segment sha256 URL found in AP playlist object.', { playlistUrl: playlistUrlObject })
      continue
    }

    const attribute = {
      type: VideoStreamingPlaylistType.HLS,
      playlistUrl: playlistUrlObject.href,
      segmentsSha256Url: segmentsSha256UrlObject.href,
      p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrlObject.href, videoFiles),
      p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
      videoId: video.id
    }

    attributes.push(attribute)
  }

  return attributes
}
