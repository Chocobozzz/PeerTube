import { VideoTorrentObject } from '../../../shared'
import { ActivityAdd } from '../../../shared/models/activitypub/activity'
import { generateThumbnailFromUrl, logger, retryTransactionWrapper, getOrCreateAccount } from '../../helpers'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'
import Bluebird = require('bluebird')
import { getOrCreateVideoChannel } from '../../helpers/activitypub'
import { VideoChannelInstance } from '../../models/video/video-channel-interface'

async function processAddActivity (activity: ActivityAdd) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccount(activity.actor)

  if (activityType === 'Video') {
    const videoChannelUrl = activity.target
    const videoChannel = await getOrCreateVideoChannel(account, videoChannelUrl)

    return processAddVideo(account, videoChannel, activityObject as VideoTorrentObject)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processAddActivity
}

// ---------------------------------------------------------------------------

function processAddVideo (account: AccountInstance, videoChannel: VideoChannelInstance, video: VideoTorrentObject) {
  const options = {
    arguments: [ account, videoChannel, video ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideo, options)
}

function addRemoteVideo (account: AccountInstance, videoChannel: VideoChannelInstance, videoToCreateData: VideoTorrentObject) {
  logger.debug('Adding remote video %s.', videoToCreateData.url)

  return db.sequelize.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }

    if (videoChannel.Account.id !== account.id) throw new Error('Video channel is not owned by this account.')

    const videoData = await videoActivityObjectToDBAttributes(videoChannel, videoToCreateData, t)
    const video = db.Video.build(videoData)

    // Don't block on request
    generateThumbnailFromUrl(video, videoToCreateData.icon)
      .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoToCreateData.id, err))

    const videoCreated = await video.save(sequelizeOptions)

    const videoFileAttributes = await videoFileActivityUrlToDBAttributes(videoCreated, videoToCreateData)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoToCreateData.url)
    }

    const tasks: Bluebird<any>[] = videoFileAttributes.map(f => db.VideoFile.create(f, { transaction: t }))
    await Promise.all(tasks)

    const tags = videoToCreateData.tag.map(t => t.name)
    const tagInstances = await db.Tag.findOrCreateTags(tags, t)
    await videoCreated.setTags(tagInstances, sequelizeOptions)

    logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid)

    return videoCreated
  })
}
