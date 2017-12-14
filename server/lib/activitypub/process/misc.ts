import * as magnetUtil from 'magnet-uri'
import { VideoTorrentObject } from '../../../../shared'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { doRequest } from '../../../helpers'
import { isVideoFileInfoHashValid } from '../../../helpers/custom-validators/videos'
import { ACTIVITY_PUB, VIDEO_MIMETYPE_EXT } from '../../../initializers'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
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

async function addVideoShares (instance: VideoModel, shares: string[]) {
  for (const share of shares) {
    // Fetch url
    const json = await doRequest({
      uri: share,
      json: true
    })
    const actorUrl = json['actor']
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

// ---------------------------------------------------------------------------

export {
  videoFileActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  addVideoShares
}
