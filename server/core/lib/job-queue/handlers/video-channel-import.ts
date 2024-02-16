import { Job } from 'bullmq'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { synchronizeChannel } from '@server/lib/sync-channel.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { MChannelSync } from '@server/types/models/index.js'
import { VideoChannelImportPayload } from '@peertube/peertube-models'

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
      throw new Error('Unknown channel sync specified in videos channel import')
    }
  }

  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(payload.videoChannelId)

  logger.info(`Starting importing videos from external channel "${payload.externalChannelUrl}" to "${videoChannel.name}" `)

  await synchronizeChannel({
    channel: videoChannel,
    externalChannelUrl: payload.externalChannelUrl,
    channelSync,
    videosCountLimit: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.FULL_SYNC_VIDEOS_LIMIT
  })
}
