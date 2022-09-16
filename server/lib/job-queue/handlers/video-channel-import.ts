import { Job } from 'bullmq'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { synchronizeChannel } from '@server/lib/sync-channel'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { MChannelSync } from '@server/types/models'
import { VideoChannelImportPayload, VideoChannelSyncState } from '@shared/models'

export async function processVideoChannelImport (job: Job) {
  const payload = job.data as VideoChannelImportPayload

  logger.info('Processing video channel import in job %s.', job.id)

  // Channel import requires only http upload to be allowed
  if (!CONFIG.IMPORT.VIDEOS.HTTP.ENABLED) {
    throw new Error('Cannot import channel as the HTTP upload is disabled')
  }

  if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
    throw new Error('Cannot import channel as the synchronization is disabled')
  }

  let channelSync: MChannelSync
  if (payload.partOfChannelSyncId) {
    channelSync = await VideoChannelSyncModel.loadWithChannel(payload.partOfChannelSyncId)

    if (!channelSync) {
      throw new Error('Unlnown channel sync specified in videos channel import')
    }
  }

  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(payload.videoChannelId)

  try {
    logger.info(`Starting importing videos from external channel "${payload.externalChannelUrl}" to "${videoChannel.name}" `)

    await synchronizeChannel({
      channel: videoChannel,
      externalChannelUrl: payload.externalChannelUrl,
      channelSync
    })
  } catch (err) {
    logger.error(`Failed to import channel ${videoChannel.name}`, { err })
    channelSync.state = VideoChannelSyncState.FAILED
    await channelSync.save()
  }
}
