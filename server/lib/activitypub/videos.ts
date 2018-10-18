import * as Bluebird from 'bluebird'
import * as sequelize from 'sequelize'
import * as magnetUtil from 'magnet-uri'
import { join } from 'path'
import * as request from 'request'
import { ActivityIconObject, ActivityUrlObject, ActivityVideoUrlObject, VideoState } from '../../../shared/index'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy } from '../../../shared/models/videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { ACTIVITY_PUB, CONFIG, REMOTE_SCHEME, sequelizeTypescript, VIDEO_MIMETYPE_EXT } from '../../initializers'
import { ActorModel } from '../../models/activitypub/actor'
import { TagModel } from '../../models/video/tag'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
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

async function federateVideoIfNeeded (video: VideoModel, isNewVideo: boolean, transaction?: sequelize.Transaction) {
  // If the video is not private and published, we federate it
  if (video.privacy !== VideoPrivacy.PRIVATE && video.state === VideoState.PUBLISHED) {
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

  if (sanitizeAndCheckVideoTorrentObject(body) === false) {
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

function fetchRemoteVideoStaticFile (video: VideoModel, path: string, reject: Function) {
  const host = video.VideoChannel.Account.Actor.Server.host

  // We need to provide a callback, if no we could have an uncaught exception
  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path, err => {
    if (err) reject(err)
  })
}

function generateThumbnailFromUrl (video: VideoModel, icon: ActivityIconObject) {
  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)

  const options = {
    method: 'GET',
    uri: icon.url
  }
  return doRequestAndSaveToFile(options, thumbnailPath)
}

function getOrCreateVideoChannelFromVideoObject (videoObject: VideoTorrentObject) {
  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  return getOrCreateActorAndServerAndModel(channel.id, 'all')
}

type SyncParam = {
  likes: boolean
  dislikes: boolean
  shares: boolean
  comments: boolean
  thumbnail: boolean
  refreshVideo: boolean
}
async function syncVideoExternalAttributes (video: VideoModel, fetchedVideo: VideoTorrentObject, syncParam: SyncParam) {
  logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid)

  const jobPayloads: ActivitypubHttpFetcherPayload[] = []

  if (syncParam.likes === true) {
    await crawlCollectionPage<string>(fetchedVideo.likes, items => createRates(items, video, 'like'))
      .catch(err => logger.error('Cannot add likes of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.likes, videoId: video.id, type: 'video-likes' as 'video-likes' })
  }

  if (syncParam.dislikes === true) {
    await crawlCollectionPage<string>(fetchedVideo.dislikes, items => createRates(items, video, 'dislike'))
      .catch(err => logger.error('Cannot add dislikes of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.dislikes, videoId: video.id, type: 'video-dislikes' as 'video-dislikes' })
  }

  if (syncParam.shares === true) {
    await crawlCollectionPage<string>(fetchedVideo.shares, items => addVideoShares(items, video))
      .catch(err => logger.error('Cannot add shares of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' as 'video-shares' })
  }

  if (syncParam.comments === true) {
    await crawlCollectionPage<string>(fetchedVideo.comments, items => addVideoComments(items, video))
      .catch(err => logger.error('Cannot add comments of video %s.', video.uuid, { err }))
  } else {
    jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' as 'video-shares' })
  }

  await Bluebird.map(jobPayloads, payload => JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload }))
}

async function getOrCreateVideoAndAccountAndChannel (options: {
  videoObject: VideoTorrentObject | string,
  syncParam?: SyncParam,
  fetchType?: VideoFetchByUrlType,
  refreshViews?: boolean
}) {
  // Default params
  const syncParam = options.syncParam || { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
  const fetchType = options.fetchType || 'all'
  const refreshViews = options.refreshViews || false

  // Get video url
  const videoUrl = typeof options.videoObject === 'string' ? options.videoObject : options.videoObject.id

  let videoFromDatabase = await fetchVideoByUrl(videoUrl, fetchType)
  if (videoFromDatabase) {
    const refreshOptions = {
      video: videoFromDatabase,
      fetchedType: fetchType,
      syncParam,
      refreshViews
    }
    const p = refreshVideoIfNeeded(refreshOptions)
    if (syncParam.refreshVideo === true) videoFromDatabase = await p

    return { video: videoFromDatabase }
  }

  const { videoObject: fetchedVideo } = await fetchRemoteVideo(videoUrl)
  if (!fetchedVideo) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  const channelActor = await getOrCreateVideoChannelFromVideoObject(fetchedVideo)
  const video = await retryTransactionWrapper(createVideo, fetchedVideo, channelActor, syncParam.thumbnail)

  await syncVideoExternalAttributes(video, fetchedVideo, syncParam)

  return { video }
}

async function updateVideoFromAP (options: {
  video: VideoModel,
  videoObject: VideoTorrentObject,
  account: AccountModel,
  channel: VideoChannelModel,
  updateViews: boolean,
  overrideTo?: string[]
}) {
  logger.debug('Updating remote video "%s".', options.videoObject.uuid)
  let videoFieldsSave: any

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      videoFieldsSave = options.video.toJSON()

      // Check actor has the right to update the video
      const videoChannel = options.video.VideoChannel
      if (videoChannel.Account.id !== options.account.id) {
        throw new Error('Account ' + options.account.Actor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const to = options.overrideTo ? options.overrideTo : options.videoObject.to
      const videoData = await videoActivityObjectToDBAttributes(options.channel, options.videoObject, to)
      options.video.set('name', videoData.name)
      options.video.set('uuid', videoData.uuid)
      options.video.set('url', videoData.url)
      options.video.set('category', videoData.category)
      options.video.set('licence', videoData.licence)
      options.video.set('language', videoData.language)
      options.video.set('description', videoData.description)
      options.video.set('support', videoData.support)
      options.video.set('nsfw', videoData.nsfw)
      options.video.set('commentsEnabled', videoData.commentsEnabled)
      options.video.set('waitTranscoding', videoData.waitTranscoding)
      options.video.set('state', videoData.state)
      options.video.set('duration', videoData.duration)
      options.video.set('createdAt', videoData.createdAt)
      options.video.set('publishedAt', videoData.publishedAt)
      options.video.set('privacy', videoData.privacy)
      options.video.set('channelId', videoData.channelId)

      if (options.updateViews === true) options.video.set('views', videoData.views)
      await options.video.save(sequelizeOptions)

      // Don't block on request
      generateThumbnailFromUrl(options.video, options.videoObject.icon)
        .catch(err => logger.warn('Cannot generate thumbnail of %s.', options.videoObject.id, { err }))

      {
        const videoFileAttributes = videoFileActivityUrlToDBAttributes(options.video, options.videoObject)
        const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

        // Remove video files that do not exist anymore
        const destroyTasks = options.video.VideoFiles
                                    .filter(f => !newVideoFiles.find(newFile => newFile.hasSameUniqueKeysThan(f)))
                                    .map(f => f.destroy(sequelizeOptions))
        await Promise.all(destroyTasks)

        // Update or add other one
        const upsertTasks = videoFileAttributes.map(a => {
          return VideoFileModel.upsert<VideoFileModel>(a, { returning: true, transaction: t })
            .then(([ file ]) => file)
        })

        options.video.VideoFiles = await Promise.all(upsertTasks)
      }

      {
        // Update Tags
        const tags = options.videoObject.tag.map(tag => tag.name)
        const tagInstances = await TagModel.findOrCreateTags(tags, t)
        await options.video.$set('Tags', tagInstances, sequelizeOptions)
      }

      {
        // Update captions
        await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(options.video.id, t)

        const videoCaptionsPromises = options.videoObject.subtitleLanguage.map(c => {
          return VideoCaptionModel.insertOrReplaceLanguage(options.video.id, c.identifier, t)
        })
        options.video.VideoCaptions = await Promise.all(videoCaptionsPromises)
      }
    })

    logger.info('Remote video with uuid %s updated', options.videoObject.uuid)
  } catch (err) {
    if (options.video !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(options.video, videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err })
    throw err
  }
}

export {
  updateVideoFromAP,
  federateVideoIfNeeded,
  fetchRemoteVideo,
  getOrCreateVideoAndAccountAndChannel,
  fetchRemoteVideoStaticFile,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl,
  getOrCreateVideoChannelFromVideoObject
}

// ---------------------------------------------------------------------------

function isActivityVideoUrlObject (url: ActivityUrlObject): url is ActivityVideoUrlObject {
  const mimeTypes = Object.keys(VIDEO_MIMETYPE_EXT)

  const urlMediaType = url.mediaType || url.mimeType
  return mimeTypes.indexOf(urlMediaType) !== -1 && urlMediaType.startsWith('video/')
}

async function createVideo (videoObject: VideoTorrentObject, channelActor: ActorModel, waitThumbnail = false) {
  logger.debug('Adding remote video %s.', videoObject.id)

  const videoCreated: VideoModel = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoData = await videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, videoObject.to)
    const video = VideoModel.build(videoData)

    const videoCreated = await video.save(sequelizeOptions)

    // Process files
    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoObject.url)
    }

    const videoFilePromises = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
    await Promise.all(videoFilePromises)

    // Process tags
    const tags = videoObject.tag.map(t => t.name)
    const tagInstances = await TagModel.findOrCreateTags(tags, t)
    await videoCreated.$set('Tags', tagInstances, sequelizeOptions)

    // Process captions
    const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
      return VideoCaptionModel.insertOrReplaceLanguage(videoCreated.id, c.identifier, t)
    })
    await Promise.all(videoCaptionsPromises)

    logger.info('Remote video with uuid %s inserted.', videoObject.uuid)

    videoCreated.VideoChannel = channelActor.VideoChannel
    return videoCreated
  })

  const p = generateThumbnailFromUrl(videoCreated, videoObject.icon)
    .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err }))

  if (waitThumbnail === true) await p

  return videoCreated
}

async function refreshVideoIfNeeded (options: {
  video: VideoModel,
  fetchedType: VideoFetchByUrlType,
  syncParam: SyncParam,
  refreshViews: boolean
}): Promise<VideoModel> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all' ? options.video : await VideoModel.loadByUrlAndPopulateAccount(options.video.url)

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
      return video
    }

    const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)
    const account = await AccountModel.load(channelActor.VideoChannel.accountId)

    const updateOptions = {
      video,
      videoObject,
      account,
      channel: channelActor.VideoChannel,
      updateViews: options.refreshViews
    }
    await retryTransactionWrapper(updateVideoFromAP, updateOptions)
    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    return video
  } catch (err) {
    logger.warn('Cannot refresh video %s.', options.video.url, { err })
    return video
  }
}

async function videoActivityObjectToDBAttributes (
  videoChannel: VideoChannelModel,
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
    waitTranscoding: videoObject.waitTranscoding,
    state: videoObject.state,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
    publishedAt: new Date(videoObject.published),
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
  const fileUrls = videoObject.url.filter(u => isActivityVideoUrlObject(u)) as ActivityVideoUrlObject[]

  if (fileUrls.length === 0) {
    throw new Error('Cannot find video files for ' + video.url)
  }

  const attributes: VideoFileModel[] = []
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
      extname: VIDEO_MIMETYPE_EXT[ mediaType ],
      infoHash: parsed.infoHash,
      resolution: fileUrl.height,
      size: fileUrl.size,
      videoId: video.id,
      fps: fileUrl.fps || -1
    } as VideoFileModel
    attributes.push(attribute)
  }

  return attributes
}
