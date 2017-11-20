import { VideoChannelObject } from '../../../shared/models/activitypub/objects/video-channel-object'
import { isVideoChannelObjectValid } from '../../helpers/custom-validators/activitypub/video-channels'
import { logger } from '../../helpers/logger'
import { doRequest } from '../../helpers/requests'
import { database as db } from '../../initializers'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { AccountInstance } from '../../models/account/account-interface'
import { videoChannelActivityObjectToDBAttributes } from './process/misc'

async function getOrCreateVideoChannel (ownerAccount: AccountInstance, videoChannelUrl: string) {
  let videoChannel = await db.VideoChannel.loadByUrl(videoChannelUrl)

  // We don't have this account in our database, fetch it on remote
  if (!videoChannel) {
    videoChannel = await fetchRemoteVideoChannel(ownerAccount, videoChannelUrl)
    if (videoChannel === undefined) throw new Error('Cannot fetch remote video channel.')

    // Save our new video channel in database
    await videoChannel.save()
  }

  return videoChannel
}

async function fetchRemoteVideoChannel (ownerAccount: AccountInstance, videoChannelUrl: string) {
  const options = {
    uri: videoChannelUrl,
    method: 'GET',
    headers: {
      'Accept': ACTIVITY_PUB.ACCEPT_HEADER
    }
  }

  logger.info('Fetching remote video channel %s.', videoChannelUrl)

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote video channel %s.', videoChannelUrl, err)
    return undefined
  }

  const videoChannelJSON: VideoChannelObject = JSON.parse(requestResult.body)
  if (isVideoChannelObjectValid(videoChannelJSON) === false) {
    logger.debug('Remote video channel JSON is not valid.', { videoChannelJSON })
    return undefined
  }

  const videoChannelAttributes = videoChannelActivityObjectToDBAttributes(videoChannelJSON, ownerAccount)
  const videoChannel = db.VideoChannel.build(videoChannelAttributes)
  videoChannel.Account = ownerAccount

  return videoChannel
}

export {
  getOrCreateVideoChannel,
  fetchRemoteVideoChannel
}
