import * as Bluebird from 'bluebird'
import * as sequelize from 'sequelize'
import * as magnetUtil from 'magnet-uri'
import { join } from 'path'
import * as request from 'request'
import { ActivityIconObject, VideoState } from '../../../shared/index'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy } from '../../../shared/models/videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { resetSequelizeInstance, retryTransactionWrapper, updateInstanceWithAnother } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { ACTIVITY_PUB, CONFIG, REMOTE_SCHEME, sequelizeTypescript, VIDEO_MIMETYPE_EXT } from '../../initializers'
import { ActorModel } from '../../models/activitypub/actor'
import { TagModel } from '../../models/video/tag'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoFileModel } from '../../models/video/video-file'
import { getOrCreateActorAndServerAndModel, updateActorAvatarInstance } from './actor'
import { addVideoComments } from './video-comments'
import { crawlCollectionPage } from './crawl'
import { sendCreateVideo, sendUpdateVideo } from './send'
import { isArray } from '../../helpers/custom-validators/misc'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { JobQueue } from '../job-queue'
import { ActivitypubHttpFetcherPayload } from '../job-queue/handlers/activitypub-http-fetcher'
import { getUrlFromWebfinger } from '../../helpers/webfinger'
import { createRates } from './video-rates'
import { addVideoShares, shareVideoByServerAndChannel } from './share'
import { AccountModel } from '../../models/account/account'

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

function fetchRemoteVideoStaticFile (video: VideoModel, path: string, reject: Function) {
  const host = video.VideoChannel.Account.Actor.Server.host

  // We need to provide a callback, if no we could have an uncaught exception
  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path, err => {
    if (err) reject(err)
  })
}

async function fetchRemoteVideoDescription (video: VideoModel) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = video.getDescriptionPath()
  const options = {
    uri: REMOTE_SCHEME.HTTP + '://' + host + path,
    json: true
  }

  const { body } = await doRequest(options)
  return body.description ? body.description : ''
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

function videoFileActivityUrlToDBAttributes (videoCreated: VideoModel, videoObject: VideoTorrentObject) {
  const mimeTypes = Object.keys(VIDEO_MIMETYPE_EXT)
  const fileUrls = videoObject.url.filter(u => {
    return mimeTypes.indexOf(u.mimeType) !== -1 && u.mimeType.startsWith('video/')
  })

  if (fileUrls.length === 0) {
    throw new Error('Cannot find video files for ' + videoCreated.url)
  }

  const attributes: VideoFileModel[] = []
  for (const fileUrl of fileUrls) {
    // Fetch associated magnet uri
    const magnet = videoObject.url.find(u => {
      return u.mimeType === 'application/x-bittorrent;x-scheme-handler/magnet' && u.height === fileUrl.height
    })

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUtil.decode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) {
      throw new Error('Cannot parse magnet URI ' + magnet.href)
    }

    const attribute = {
      extname: VIDEO_MIMETYPE_EXT[ fileUrl.mimeType ],
      infoHash: parsed.infoHash,
      resolution: fileUrl.height,
      size: fileUrl.size,
      videoId: videoCreated.id,
      fps: fileUrl.fps
    } as VideoFileModel
    attributes.push(attribute)
  }

  return attributes
}

function getOrCreateVideoChannelFromVideoObject (videoObject: VideoTorrentObject) {
  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  return getOrCreateActorAndServerAndModel(channel.id)
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

type SyncParam = {
  likes: boolean
  dislikes: boolean
  shares: boolean
  comments: boolean
  thumbnail: boolean
  refreshVideo: boolean
}
async function getOrCreateVideoAndAccountAndChannel (
  videoObject: VideoTorrentObject | string,
  syncParam: SyncParam = { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false }
) {
  const videoUrl = typeof videoObject === 'string' ? videoObject : videoObject.id

  let videoFromDatabase = await VideoModel.loadByUrlAndPopulateAccount(videoUrl)
  if (videoFromDatabase) {
    const p = retryTransactionWrapper(refreshVideoIfNeeded, videoFromDatabase)
    if (syncParam.refreshVideo === true) videoFromDatabase = await p

    return { video: videoFromDatabase }
  }

  const { videoObject: fetchedVideo } = await fetchRemoteVideo(videoUrl)
  if (!fetchedVideo) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  const channelActor = await getOrCreateVideoChannelFromVideoObject(fetchedVideo)
  const video = await retryTransactionWrapper(createVideo, fetchedVideo, channelActor, syncParam.thumbnail)

  // Process outside the transaction because we could fetch remote data

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

  return { video }
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

async function refreshVideoIfNeeded (video: VideoModel): Promise<VideoModel> {
  if (!video.isOutdated()) return video

  try {
    const { response, videoObject } = await fetchRemoteVideo(video.url)
    if (response.statusCode === 404) {
      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video: invalid body.')
      return video
    }

    const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)
    const account = await AccountModel.load(channelActor.VideoChannel.accountId)
    return updateVideoFromAP(video, videoObject, account.Actor, channelActor)

  } catch (err) {
    logger.warn('Cannot refresh video.', { err })
    return video
  }
}

async function updateVideoFromAP (
  video: VideoModel,
  videoObject: VideoTorrentObject,
  accountActor: ActorModel,
  channelActor: ActorModel,
  overrideTo?: string[]
) {
  logger.debug('Updating remote video "%s".', videoObject.uuid)
  let videoFieldsSave: any

  try {
    const updatedVideo: VideoModel = await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      videoFieldsSave = video.toJSON()

      // Check actor has the right to update the video
      const videoChannel = video.VideoChannel
      if (videoChannel.Account.Actor.id !== accountActor.id) {
        throw new Error('Account ' + accountActor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const to = overrideTo ? overrideTo : videoObject.to
      const videoData = await videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, to)
      video.set('name', videoData.name)
      video.set('uuid', videoData.uuid)
      video.set('url', videoData.url)
      video.set('category', videoData.category)
      video.set('licence', videoData.licence)
      video.set('language', videoData.language)
      video.set('description', videoData.description)
      video.set('support', videoData.support)
      video.set('nsfw', videoData.nsfw)
      video.set('commentsEnabled', videoData.commentsEnabled)
      video.set('waitTranscoding', videoData.waitTranscoding)
      video.set('state', videoData.state)
      video.set('duration', videoData.duration)
      video.set('createdAt', videoData.createdAt)
      video.set('publishedAt', videoData.publishedAt)
      video.set('views', videoData.views)
      video.set('privacy', videoData.privacy)
      video.set('channelId', videoData.channelId)

      await video.save(sequelizeOptions)

      // Don't block on request
      generateThumbnailFromUrl(video, videoObject.icon)
        .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err }))

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of video.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileAttributes = videoFileActivityUrlToDBAttributes(video, videoObject)
      const tasks = videoFileAttributes.map(f => VideoFileModel.create(f, sequelizeOptions))
      await Promise.all(tasks)

      // Update Tags
      const tags = videoObject.tag.map(tag => tag.name)
      const tagInstances = await TagModel.findOrCreateTags(tags, t)
      await video.$set('Tags', tagInstances, sequelizeOptions)

      // Update captions
      await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(video.id, t)

      const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
        return VideoCaptionModel.insertOrReplaceLanguage(video.id, c.identifier, t)
      })
      await Promise.all(videoCaptionsPromises)
    })

    logger.info('Remote video with uuid %s updated', videoObject.uuid)

    return updatedVideo
  } catch (err) {
    if (video !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(video, videoFieldsSave)
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
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes,
  createVideo,
  getOrCreateVideoChannelFromVideoObject,
  addVideoShares,
  createRates
}
