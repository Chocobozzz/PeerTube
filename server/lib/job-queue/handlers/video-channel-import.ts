import { logger } from '@server/helpers/logger'
import { YoutubeDLCLI } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoChannelImportPayload } from '@shared/models'
import { Job } from 'bull'
import { synchronizeChannel } from '@server/lib/video-import-channel'

export async function processVideoChannelImport (job: Job) {
  const payload = job.data as VideoChannelImportPayload
  logger.debug('Running processVideoChannelImport')

  // Channel import requires only http upload to be allowed
  if (!CONFIG.IMPORT.VIDEOS.HTTP.ENABLED) {
    logger.error('Cannot import channel as the HTTP upload is disabled')
    return
  }

  const videoChannel = await VideoChannelModel.findOne({
    where: {
      id: payload.videoChannelId
    }
  })
  const youtubeDL = await YoutubeDLCLI.safeGet()
  try {
    logger.info(`Starting importing videos from external channel "${payload.externalChannelUrl}" to "${videoChannel.name}" `)
    const { errors, successes, alreadyImported } = await synchronizeChannel(videoChannel, payload.externalChannelUrl, {
      youtubeDL,
      secondsToWait: 30
    })
    if (errors > 0) {
      logger.error(`Finished importing videos to "${videoChannel.name}" with failures` +
        ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
    } else {
      logger.info(`Finished importing videos to "${videoChannel.name}" successfully` +
        ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
    }
  } catch (ex) {
    logger.error(`Failed to import channel ${videoChannel.name}: ${ex.stack}`)
  }
}
