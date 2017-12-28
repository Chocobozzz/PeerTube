import * as magnetUtil from 'magnet-uri'
import { VideoTorrentObject } from '../../../../shared'
import { VideoCommentObject } from '../../../../shared/models/activitypub/objects/video-comment-object'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { isVideoFileInfoHashValid } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ACTIVITY_PUB, VIDEO_MIMETYPE_EXT } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from '../actor'

async function videoActivityObjectToDBAttributes (
  videoChannel: VideoChannelModel,
  videoObject: VideoTorrentObject,
  to: string[] = [],
  cc: string[] = []
) {
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

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.url)

    const parsed = magnetUtil.decode(magnet.url)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) throw new Error('Cannot parse magnet URI ' + magnet.url)

    const attribute = {
      extname: VIDEO_MIMETYPE_EXT[fileUrl.mimeType],
      infoHash: parsed.infoHash,
      resolution: fileUrl.width,
      size: fileUrl.size,
      videoId: videoCreated.id
    }
    attributes.push(attribute)
  }

  return attributes
}

async function videoCommentActivityObjectToDBAttributes (video: VideoModel, actor: ActorModel, comment: VideoCommentObject) {
  let originCommentId: number = null
  let inReplyToCommentId: number = null

  // If this is not a reply to the video (thread), create or get the parent comment
  if (video.url !== comment.inReplyTo) {
    const [ parent ] = await addVideoComment(video, comment.inReplyTo)
    if (!parent) {
      logger.warn('Cannot fetch or get parent comment %s of comment %s.', comment.inReplyTo, comment.id)
      return undefined
    }

    originCommentId = parent.originCommentId || parent.id
    inReplyToCommentId = parent.id
  }

  return {
    url: comment.url,
    text: comment.content,
    videoId: video.id,
    accountId: actor.Account.id,
    inReplyToCommentId,
    originCommentId,
    createdAt: new Date(comment.published),
    updatedAt: new Date(comment.updated)
  }
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

async function addVideoComments (instance: VideoModel, commentUrls: string[]) {
  for (const commentUrl of commentUrls) {
    await addVideoComment(instance, commentUrl)
  }
}

async function addVideoComment (instance: VideoModel, commentUrl: string) {
  // Fetch url
  const { body } = await doRequest({
    uri: commentUrl,
    json: true,
    activityPub: true
  })

  const actorUrl = body.attributedTo
  if (!actorUrl) return []

  const actor = await getOrCreateActorAndServerAndModel(actorUrl)
  const entry = await videoCommentActivityObjectToDBAttributes(instance, actor, body)
  if (!entry) return []

  return VideoCommentModel.findOrCreate({
    where: {
      url: body.id
    },
    defaults: entry
  })
}

// ---------------------------------------------------------------------------

export {
  videoFileActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  addVideoShares,
  addVideoComments
}
