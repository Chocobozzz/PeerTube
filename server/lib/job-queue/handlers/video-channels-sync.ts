import { logger } from '@server/helpers/logger'
import { YoutubeDLCLI } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { UserModel } from '@server/models/user/user'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoImportModel } from '@server/models/video/video-import'
import { VideoChannelImportPayload, VideoChannelSyncState, VideoPrivacy } from '@shared/models'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { VIDEO_CHANNEL_MAX_SYNC } from '@server/initializers/constants'
import { Job } from 'bull'
import { wait } from '@shared/core-utils'
import { addYoutubeDLImport } from '@server/lib/video-import'

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

type ChannelSyncInfo = {
  total: number
  alreadyImported: number
  errors: number
  successes: number
}

function formatDateForYoutubeDl (date: Date) {
  return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(date.getDate()).toString().padStart(2, '0')}`
}

export async function processVideoChannelsSync () {
  logger.debug('Running processVideoChannelsSync')
  if (!CONFIG.IMPORT.SYNCHRONIZATION.ENABLED) {
    logger.info('Discard channels synchronization as the feature is disabled')
    return
  }
  const syncs: VideoChannelSyncModel[] = await VideoChannelSyncModel.listSyncs()
  const youtubeDL = await YoutubeDLCLI.safeGet()

  for (const sync of syncs) {
    try {
      const syncCreationDate = sync.createdAt
      sync.state = VideoChannelSyncState.PROCESSING
      sync.lastSyncAt = new Date()
      await sync.save()
      // Format
      logger.info(`Starting synchronizing "${sync.VideoChannel.name}" with external channel "${sync.externalChannelUrl}"`)
      const { errors, successes, alreadyImported } = await synchronizeChannel(sync.VideoChannel, sync.externalChannelUrl, {
        youtubeDL,
        secondsToWait: 5,
        lastVideosCount: VIDEO_CHANNEL_MAX_SYNC,
        after: formatDateForYoutubeDl(syncCreationDate)
      })
      if (errors > 0) {
        sync.state = VideoChannelSyncState.FAILED
        logger.error(`Finished synchronizing "${sync.VideoChannel.name}" with failures` +
          ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
      } else {
        sync.state = VideoChannelSyncState.SYNCED
        logger.info(`Finished synchronizing "${sync.VideoChannel.name}" successfully` +
          ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
      }
      await sync.save()
    } catch (err) {
      logger.error(`Failed to synchronize channel ${sync.VideoChannel.name}`, { err })
    }
  }
}

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

type SynchronizeChannelOptions = {
  youtubeDL: YoutubeDLCLI
  secondsToWait: number
  lastVideosCount?: number
  after?: string
}

async function synchronizeChannel (
  channel: VideoChannelModel,
  externalChannelUrl: string,
  { youtubeDL, secondsToWait, lastVideosCount, after }: SynchronizeChannelOptions
): Promise<ChannelSyncInfo> {
  const result: ChannelSyncInfo = {
    total: VIDEO_CHANNEL_MAX_SYNC,
    errors: 0,
    successes: 0,
    alreadyImported: 0
  }
  const user = await UserModel.loadByChannelActorId(channel.actorId)
  const channelInfo = await youtubeDL.getChannelInfo({
    lastVideosCount,
    channelUrl: externalChannelUrl,
    processOptions
  })
  const targetUrls: string[] = (await Promise.all(
    channelInfo.map(video => {
      if (after && video['upload_date'] <= after) {
        return []
      }
      return video['webpage_url']
    })
  )).flat()
  logger.debug('Fetched %d candidate URLs for upload: %j', targetUrls.length, targetUrls)

  await wait(secondsToWait * 1000)

  for (const targetUrl of targetUrls) {
    try {
      // TODO retry pour l'import d'une chaîne ?
      if (!await VideoImportModel.urlAlreadyImported(channel.id, targetUrl)) {
        const { job } = await addYoutubeDLImport({
          user,
          channel,
          targetUrl,
          importDataOverride: {
            privacy: VideoPrivacy.PUBLIC
          }
        })
        await job.finished()
        result.successes += 1
      } else {
        result.alreadyImported += 1
      }
    } catch (ex) {
      result.errors += 1
      logger.error(`An error occured while importing ${targetUrl}: ${ex.stack}`)
    }
    await wait(secondsToWait * 1000)
  }
  return result
}
