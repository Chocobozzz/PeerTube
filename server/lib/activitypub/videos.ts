import * as magnetUtil from 'magnet-uri'
import { join } from 'path'
import * as request from 'request'
import { ActivityIconObject } from '../../../shared/index'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { VideoPrivacy } from '../../../shared/models/videos'
import { isVideoTorrentObjectValid } from '../../helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { ACTIVITY_PUB, CONFIG, REMOTE_SCHEME, sequelizeTypescript, STATIC_PATHS, VIDEO_MIMETYPE_EXT } from '../../initializers'
import { ActorModel } from '../../models/activitypub/actor'
import { TagModel } from '../../models/video/tag'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoShareModel } from '../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from './actor'

function fetchRemoteVideoPreview (video: VideoModel, reject: Function) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

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

async function videoActivityObjectToDBAttributes (videoChannel: VideoChannelModel,
                                                  videoObject: VideoTorrentObject,
                                                  to: string[] = [],
                                                  cc: string[] = []) {
  let privacy = VideoPrivacy.PRIVATE
  if (to.indexOf(ACTIVITY_PUB.PUBLIC) !== -1) privacy = VideoPrivacy.PUBLIC
  else if (cc.indexOf(ACTIVITY_PUB.PUBLIC) !== -1) privacy = VideoPrivacy.UNLISTED

  const duration = videoObject.duration.replace(/[^\d]+/, '')
  let language = null
  if (videoObject.language) {
    language = parseInt(videoObject.language.identifier, 10)
  }

  let category = null
  if (videoObject.category) {
    category = parseInt(videoObject.category.identifier, 10)
  }

  let licence = null
  if (videoObject.licence) {
    licence = parseInt(videoObject.licence.identifier, 10)
  }

  let description = null
  if (videoObject.content) {
    description = videoObject.content
  }

  return {
    name: videoObject.name,
    uuid: videoObject.uuid,
    url: videoObject.id,
    category,
    licence,
    language,
    description,
    nsfw: videoObject.nsfw,
    commentsEnabled: videoObject.commentsEnabled,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
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

  const attributes = []
  for (const fileUrl of fileUrls) {
    // Fetch associated magnet uri
    const magnet = videoObject.url.find(u => {
      return u.mimeType === 'application/x-bittorrent;x-scheme-handler/magnet' && u.width === fileUrl.width
    })

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUtil.decode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) throw new Error('Cannot parse magnet URI ' + magnet.href)

    const attribute = {
      extname: VIDEO_MIMETYPE_EXT[ fileUrl.mimeType ],
      infoHash: parsed.infoHash,
      resolution: fileUrl.width,
      size: fileUrl.size,
      videoId: videoCreated.id
    }
    attributes.push(attribute)
  }

  return attributes
}

async function getOrCreateVideo (videoObject: VideoTorrentObject, channelActor: ActorModel) {
  logger.debug('Adding remote video %s.', videoObject.id)

  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }
    const videoFromDatabase = await VideoModel.loadByUUIDOrURLAndPopulateAccount(videoObject.uuid, videoObject.id, t)
    if (videoFromDatabase) return videoFromDatabase

    const videoData = await videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, videoObject.to, videoObject.cc)
    const video = VideoModel.build(videoData)

    // Don't block on request
    generateThumbnailFromUrl(video, videoObject.icon)
      .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoObject.id, err))

    const videoCreated = await video.save(sequelizeOptions)

    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoObject.url)
    }

    const tasks = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
    await Promise.all(tasks)

    const tags = videoObject.tag.map(t => t.name)
    const tagInstances = await TagModel.findOrCreateTags(tags, t)
    await videoCreated.$set('Tags', tagInstances, sequelizeOptions)

    logger.info('Remote video with uuid %s inserted.', videoObject.uuid)

    videoCreated.VideoChannel = channelActor.VideoChannel
    return videoCreated
  })
}

async function getOrCreateAccountAndVideoAndChannel (videoObject: VideoTorrentObject | string, actor?: ActorModel) {
  if (typeof videoObject === 'string') {
    const videoFromDatabase = await VideoModel.loadByUrlAndPopulateAccount(videoObject)
    if (videoFromDatabase) {
      return {
        video: videoFromDatabase,
        actor: videoFromDatabase.VideoChannel.Account.Actor,
        channelActor: videoFromDatabase.VideoChannel.Actor
      }
    }

    videoObject = await fetchRemoteVideo(videoObject)
    if (!videoObject) throw new Error('Cannot fetch remote video')
  }

  if (!actor) {
    const actorObj = videoObject.attributedTo.find(a => a.type === 'Person')
    if (!actorObj) throw new Error('Cannot find associated actor to video ' + videoObject.url)

    actor = await getOrCreateActorAndServerAndModel(actorObj.id)
  }

  const channel = videoObject.attributedTo.find(a => a.type === 'Group')
  if (!channel) throw new Error('Cannot find associated video channel to video ' + videoObject.url)

  const channelActor = await getOrCreateActorAndServerAndModel(channel.id)

  const options = {
    arguments: [ videoObject, channelActor ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  const video = await retryTransactionWrapper(getOrCreateVideo, options)

  return { actor, channelActor, video }
}

async function addVideoShares (instance: VideoModel, shareUrls: string[]) {
  for (const shareUrl of shareUrls) {
    // Fetch url
    const { body } = await doRequest({
      uri: shareUrl,
      json: true,
      activityPub: true
    })
    const actorUrl = body.actor
    if (!actorUrl) continue

    const actor = await getOrCreateActorAndServerAndModel(actorUrl)

    const entry = {
      actorId: actor.id,
      videoId: instance.id
    }

    await VideoShareModel.findOrCreate({
      where: entry,
      defaults: entry
    })
  }
}

export {
  getOrCreateAccountAndVideoAndChannel,
  fetchRemoteVideoPreview,
  fetchRemoteVideoDescription,
  generateThumbnailFromUrl,
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes,
  getOrCreateVideo,
  addVideoShares}

// ---------------------------------------------------------------------------

async function fetchRemoteVideo (videoUrl: string): Promise<VideoTorrentObject> {
  const options = {
    uri: videoUrl,
    method: 'GET',
    json: true,
    activityPub: true
  }

  logger.info('Fetching remote video %s.', videoUrl)

  const { body } = await doRequest(options)

  if (isVideoTorrentObjectValid(body) === false) {
    logger.debug('Remote video JSON is not valid.', { body })
    return undefined
  }

  return body
}
