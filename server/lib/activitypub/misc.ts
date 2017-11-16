import * as magnetUtil from 'magnet-uri'
import * as Sequelize from 'sequelize'
import { VideoTorrentObject } from '../../../shared'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { database as db } from '../../initializers'
import { VIDEO_MIMETYPE_EXT } from '../../initializers/constants'
import { VideoChannelInstance } from '../../models/video/video-channel-interface'
import { VideoFileAttributes } from '../../models/video/video-file-interface'
import { VideoAttributes, VideoInstance } from '../../models/video/video-interface'

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
  const fileUrls = videoObject.url
    .filter(u => Object.keys(VIDEO_MIMETYPE_EXT).indexOf(u.mimeType) !== -1 && u.url.startsWith('video/'))

  const attributes: VideoFileAttributes[] = []
  for (const url of fileUrls) {
    // Fetch associated magnet uri
    const magnet = videoObject.url
      .find(u => {
        return u.mimeType === 'application/x-bittorrent;x-scheme-handler/magnet' && u.width === url.width
      })
    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + url.url)

    const parsed = magnetUtil.decode(magnet.url)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) throw new Error('Cannot parse magnet URI ' + magnet.url)

    const attribute = {
      extname: VIDEO_MIMETYPE_EXT[url.mimeType],
      infoHash: parsed.infoHash,
      resolution: url.width,
      size: url.size,
      videoId: videoCreated.id
    }
    attributes.push(attribute)
  }

  return attributes
}

// ---------------------------------------------------------------------------

export {
  videoFileActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes
}
