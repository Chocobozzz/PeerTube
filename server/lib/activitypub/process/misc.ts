import * as magnetUtil from 'magnet-uri'
import { VideoTorrentObject } from '../../../../shared'
import { VideoChannelObject } from '../../../../shared/models/activitypub/objects/video-channel-object'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import { isVideoFileInfoHashValid } from '../../../helpers/custom-validators/videos'
import { doRequest } from '../../../helpers/requests'
import { database as db } from '../../../initializers'
import { ACTIVITY_PUB, VIDEO_MIMETYPE_EXT } from '../../../initializers/constants'
import { AccountInstance } from '../../../models/account/account-interface'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { VideoFileAttributes } from '../../../models/video/video-file-interface'
import { VideoAttributes, VideoInstance } from '../../../models/video/video-interface'
import { getOrCreateAccountAndServer } from '../account'

function videoChannelActivityObjectToDBAttributes (videoChannelObject: VideoChannelObject, account: AccountInstance) {
  return {
    name: videoChannelObject.name,
    description: videoChannelObject.content,
    uuid: videoChannelObject.uuid,
    url: videoChannelObject.id,
    createdAt: new Date(videoChannelObject.published),
    updatedAt: new Date(videoChannelObject.updated),
    remote: true,
    accountId: account.id
  }
}

async function videoActivityObjectToDBAttributes (
  videoChannel: VideoChannelInstance,
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

  const videoData: VideoAttributes = {
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

  return videoData
}

function videoFileActivityUrlToDBAttributes (videoCreated: VideoInstance, videoObject: VideoTorrentObject) {
  const mimeTypes = Object.keys(VIDEO_MIMETYPE_EXT)
  const fileUrls = videoObject.url.filter(u => {
    return mimeTypes.indexOf(u.mimeType) !== -1 && u.mimeType.startsWith('video/')
  })

  if (fileUrls.length === 0) {
    throw new Error('Cannot find video files for ' + videoCreated.url)
  }

  const attributes: VideoFileAttributes[] = []
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

async function addVideoShares (instance: VideoInstance, shares: string[]) {
  for (const share of shares) {
    // Fetch url
    const json = await doRequest({
      uri: share,
      json: true
    })
    const actor = json['actor']
    if (!actor) continue

    const account = await getOrCreateAccountAndServer(actor)

    const entry = {
      accountId: account.id,
      videoId: instance.id
    }

    await db.VideoShare.findOrCreate({
      where: entry,
      defaults: entry
    })
  }
}

async function addVideoChannelShares (instance: VideoChannelInstance, shares: string[]) {
  for (const share of shares) {
    // Fetch url
    const json = await doRequest({
      uri: share,
      json: true
    })
    const actor = json['actor']
    if (!actor) continue

    const account = await getOrCreateAccountAndServer(actor)

    const entry = {
      accountId: account.id,
      videoChannelId: instance.id
    }

    await db.VideoChannelShare.findOrCreate({
      where: entry,
      defaults: entry
    })
  }
}

// ---------------------------------------------------------------------------

export {
  videoFileActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  videoChannelActivityObjectToDBAttributes,
  addVideoChannelShares,
  addVideoShares
}
