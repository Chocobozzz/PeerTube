import * as Bluebird from 'bluebird'
import * as sequelize from 'sequelize'
import * as magnetUtil from 'magnet-uri'
import { join } from 'path'
import * as request from 'request'
import { ActivityIconObject, VideoState } from '../../../shared/index'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy, VideoRateType } from '../../../shared/models/videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { ACTIVITY_PUB, CONFIG, REMOTE_SCHEME, sequelizeTypescript, STATIC_PATHS, VIDEO_MIMETYPE_EXT } from '../../initializers'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { ActorModel } from '../../models/activitypub/actor'
import { TagModel } from '../../models/video/tag'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoShareModel } from '../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from './actor'
import { addVideoComments } from './video-comments'
import { crawlCollectionPage } from './crawl'
import { sendCreateVideo, sendUpdateVideo } from './send'
import { shareVideoByServerAndChannel } from './index'
import { isArray } from '../../helpers/custom-validators/misc'
import { VideoCaptionModel } from '../../models/video/video-caption'

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
      return u.mimeType === 'application/x-bittorrent;x-scheme-handler/magnet' && u.width === fileUrl.width
    })

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUtil.decode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) {
      throw new Error('Cannot parse magnet URI ' + magnet.href)
    }

    const attribute = {
      extname: VIDEO_MIMETYPE_EXT[ fileUrl.mimeType ],
      infoHash: parsed.infoHash,
      resolution: fileUrl.width,
      size: fileUrl.size,
      videoId: videoCreated.id
    } as VideoFileModel
    attributes.push(attribute)
  }

  return attributes
}

function getOrCreateVideoChannel (videoObject: VideoTorrentObject) {
  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  return getOrCreateActorAndServerAndModel(channel.id)
}

async function getOrCreateVideo (videoObject: VideoTorrentObject, channelActor: ActorModel) {
  logger.debug('Adding remote video %s.', videoObject.id)

  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }
    const videoFromDatabase = await VideoModel.loadByUUIDOrURLAndPopulateAccount(videoObject.uuid, videoObject.id, t)
    if (videoFromDatabase) return videoFromDatabase

    const videoData = await videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, videoObject.to)
    const video = VideoModel.build(videoData)

    // Don't block on remote HTTP request (we are in a transaction!)
    generateThumbnailFromUrl(video, videoObject.icon)
      .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err }))

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
}

async function getOrCreateAccountAndVideoAndChannel (videoObject: VideoTorrentObject | string, actor?: ActorModel) {
  const videoUrl = typeof videoObject === 'string' ? videoObject : videoObject.id

  const videoFromDatabase = await VideoModel.loadByUrlAndPopulateAccount(videoUrl)
  if (videoFromDatabase) {
    return {
      video: videoFromDatabase,
      actor: videoFromDatabase.VideoChannel.Account.Actor,
      channelActor: videoFromDatabase.VideoChannel.Actor
    }
  }

  videoObject = await fetchRemoteVideo(videoUrl)
  if (!videoObject) throw new Error('Cannot fetch remote video with url: ' + videoUrl)

  if (!actor) {
    const actorObj = videoObject.attributedTo.find(a => a.type === 'Person')
    if (!actorObj) throw new Error('Cannot find associated actor to video ' + videoObject.url)

    actor = await getOrCreateActorAndServerAndModel(actorObj.id)
  }

  const channelActor = await getOrCreateVideoChannel(videoObject)

  const video = await retryTransactionWrapper(getOrCreateVideo, videoObject, channelActor)

  // Process outside the transaction because we could fetch remote data
  logger.info('Adding likes of video %s.', video.uuid)
  await crawlCollectionPage<string>(videoObject.likes, (items) => createRates(items, video, 'like'))

  logger.info('Adding dislikes of video %s.', video.uuid)
  await crawlCollectionPage<string>(videoObject.dislikes, (items) => createRates(items, video, 'dislike'))

  logger.info('Adding shares of video %s.', video.uuid)
  await crawlCollectionPage<string>(videoObject.shares, (items) => addVideoShares(items, video))

  logger.info('Adding comments of video %s.', video.uuid)
  await crawlCollectionPage<string>(videoObject.comments, (items) => addVideoComments(items, video))

  return { actor, channelActor, video }
}

async function createRates (actorUrls: string[], video: VideoModel, rate: VideoRateType) {
  let rateCounts = 0
  const tasks: Bluebird<number>[] = []

  for (const actorUrl of actorUrls) {
    const actor = await getOrCreateActorAndServerAndModel(actorUrl)
    const p = AccountVideoRateModel
      .create({
        videoId: video.id,
        accountId: actor.Account.id,
        type: rate
      })
      .then(() => rateCounts += 1)

    tasks.push(p)
  }

  await Promise.all(tasks)

  logger.info('Adding %d %s to video %s.', rateCounts, rate, video.uuid)

  // This is "likes" and "dislikes"
  if (rateCounts !== 0) await video.increment(rate + 's', { by: rateCounts })

  return
}

async function addVideoShares (shareUrls: string[], instance: VideoModel) {
  for (const shareUrl of shareUrls) {
    // Fetch url
    const { body } = await doRequest({
      uri: shareUrl,
      json: true,
      activityPub: true
    })
    if (!body || !body.actor) {
      logger.warn('Cannot add remote share with url: %s, skipping...', shareUrl)
      continue
    }

    const actorUrl = body.actor
    const actor = await getOrCreateActorAndServerAndModel(actorUrl)

    const entry = {
      actorId: actor.id,
      videoId: instance.id,
      url: shareUrl
    }

    await VideoShareModel.findOrCreate({
      where: {
        url: shareUrl
      },
      defaults: entry
    })
  }
}

async function fetchRemoteVideo (videoUrl: string): Promise<VideoTorrentObject> {
  const options = {
    uri: videoUrl,
    method: 'GET',
    json: true,
    activityPub: true
  }

  logger.info('Fetching remote video %s.', videoUrl)

  const { body } = await doRequest(options)

  if (sanitizeAndCheckVideoTorrentObject(body) === false) {
    logger.debug('Remote video JSON is not valid.', { body })
    return undefined
  }

  return body
}

export {
  federateVideoIfNeeded,
  fetchRemoteVideo,
  getOrCreateAccountAndVideoAndChannel,
  fetchRemoteVideoStaticFile,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl,
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes,
  getOrCreateVideo,
  getOrCreateVideoChannel,
  addVideoShares
}
