import {
  ActivityCreate,
  VideoTorrentObject,
  VideoChannelObject
} from '../../../shared'
import { database as db } from '../../initializers'
import { logger, retryTransactionWrapper } from '../../helpers'

function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type

  if (activityType === 'Video') {
    return processCreateVideo(activityObject as VideoTorrentObject)
  } else if (activityType === 'VideoChannel') {
    return processCreateVideoChannel(activityObject as VideoChannelObject)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve()
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

function processCreateVideo (video: VideoTorrentObject) {
  const options = {
    arguments: [ video ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideo, options)
}

async function addRemoteVideo (videoToCreateData: VideoTorrentObject) {
  logger.debug('Adding remote video %s.', videoToCreateData.url)

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }

    const videoFromDatabase = await db.Video.loadByUUID(videoToCreateData.uuid)
    if (videoFromDatabase) throw new Error('UUID already exists.')

    const videoChannel = await db.VideoChannel.loadByHostAndUUID(fromPod.host, videoToCreateData.channelUUID, t)
    if (!videoChannel) throw new Error('Video channel ' + videoToCreateData.channelUUID + ' not found.')

    const tags = videoToCreateData.tags
    const tagInstances = await db.Tag.findOrCreateTags(tags, t)

    const videoData = {
      name: videoToCreateData.name,
      uuid: videoToCreateData.uuid,
      category: videoToCreateData.category,
      licence: videoToCreateData.licence,
      language: videoToCreateData.language,
      nsfw: videoToCreateData.nsfw,
      description: videoToCreateData.truncatedDescription,
      channelId: videoChannel.id,
      duration: videoToCreateData.duration,
      createdAt: videoToCreateData.createdAt,
      // FIXME: updatedAt does not seems to be considered by Sequelize
      updatedAt: videoToCreateData.updatedAt,
      views: videoToCreateData.views,
      likes: videoToCreateData.likes,
      dislikes: videoToCreateData.dislikes,
      remote: true,
      privacy: videoToCreateData.privacy
    }

    const video = db.Video.build(videoData)
    await db.Video.generateThumbnailFromData(video, videoToCreateData.thumbnailData)
    const videoCreated = await video.save(sequelizeOptions)

    const tasks = []
    for (const fileData of videoToCreateData.files) {
      const videoFileInstance = db.VideoFile.build({
        extname: fileData.extname,
        infoHash: fileData.infoHash,
        resolution: fileData.resolution,
        size: fileData.size,
        videoId: videoCreated.id
      })

      tasks.push(videoFileInstance.save(sequelizeOptions))
    }

    await Promise.all(tasks)

    await videoCreated.setTags(tagInstances, sequelizeOptions)
  })

  logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid)
}

function processCreateVideoChannel (videoChannel: VideoChannelObject) {

}
