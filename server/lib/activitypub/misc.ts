import * as magnetUtil from 'magnet-uri'
import * as Sequelize from 'sequelize'
import { VideoTorrentObject } from '../../../shared'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { database as db } from '../../initializers'
import { VIDEO_MIMETYPE_EXT } from '../../initializers/constants'
import { VideoChannelInstance } from '../../models/video/video-channel-interface'
import { VideoFileAttributes } from '../../models/video/video-file-interface'
import { VideoAttributes, VideoInstance } from '../../models/video/video-interface'
import { VideoChannelObject } from '../../../shared/models/activitypub/objects/video-channel-object'
import { AccountInstance } from '../../models/account/account-interface'

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
  t: Sequelize.Transaction
) {
  const videoFromDatabase = await db.Video.loadByUUIDOrURL(videoObject.uuid, videoObject.id, t)
  if (videoFromDatabase) throw new Error('Video with this UUID/Url already exists.')

  const duration = videoObject.duration.replace(/[^\d]+/, '')
  const videoData: VideoAttributes = {
    name: videoObject.name,
    uuid: videoObject.uuid,
    url: videoObject.id,
    category: parseInt(videoObject.category.identifier, 10),
    licence: parseInt(videoObject.licence.identifier, 10),
    language: parseInt(videoObject.language.identifier, 10),
    nsfw: videoObject.nsfw,
    description: videoObject.content,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
    // FIXME: updatedAt does not seems to be considered by Sequelize
    updatedAt: new Date(videoObject.updated),
    views: videoObject.views,
    likes: 0,
    dislikes: 0,
    // likes: videoToCreateData.likes,
    // dislikes: videoToCreateData.dislikes,
    remote: true,
    privacy: 1
    // privacy: videoToCreateData.privacy
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

// ---------------------------------------------------------------------------

export {
  videoFileActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  videoChannelActivityObjectToDBAttributes
}
