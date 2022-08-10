import { Job } from 'bullmq'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { synchronizeChannel } from '@server/lib/sync-channel'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoChannelImportPayload } from '@shared/models'

export async function processVideoChannelImport (job: Job) {
  const payload = job.data as VideoChannelImportPayload

  logger.info('Processing video channel import in job %s.', job.id)

  // Channel import requires only http upload to be allowed
  if (!CONFIG.IMPORT.VIDEOS.HTTP.ENABLED) {
    logger.error('Cannot import channel as the HTTP upload is disabled')
    return
  }

  if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
    logger.error('Cannot import channel as the synchronization is disabled')
    return
  }

  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(payload.videoChannelId)

  try {
    logger.info(`Starting importing videos from external channel "${payload.externalChannelUrl}" to "${videoChannel.name}" `)

    await synchronizeChannel({
      channel: videoChannel,
      externalChannelUrl: payload.externalChannelUrl
    })
  } catch (err) {
    logger.error(`Failed to import channel ${videoChannel.name}`, { err })
  }
}
