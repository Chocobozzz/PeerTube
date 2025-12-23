import { VideoChannelSyncState, VideoPrivacy } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { YoutubeDLWrapper } from '@server/helpers/youtube-dl/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildYoutubeDLImport } from '@server/lib/video-pre-import.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { MChannelAccountDefault, MChannelSync } from '@server/types/models/index.js'
import { CreateJobArgument, JobQueue } from './job-queue/index.js'
import { ServerConfigManager } from './server-config-manager.js'

const lTags = loggerTagsFactory('channel-synchronization')

export async function synchronizeChannel (options: {
  channel: MChannelAccountDefault
  externalChannelUrl: string
  videosCountLimit: number
  channelSync?: MChannelSync
  skipPublishedBefore?: Date
}) {
  const { channel, externalChannelUrl, videosCountLimit, skipPublishedBefore, channelSync } = options

  if (channelSync) {
    channelSync.state = VideoChannelSyncState.PROCESSING
    channelSync.lastSyncAt = new Date()
    await channelSync.save()
  }

  try {
    const user = await UserModel.loadByChannelActorId(channel.Actor.id)
    const youtubeDL = new YoutubeDLWrapper(
      externalChannelUrl,
      ServerConfigManager.Instance.getEnabledResolutions('vod'),
      CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
    )

    const targetUrls = await youtubeDL.getInfoForListImport({ latestVideosCount: videosCountLimit })

    logger.info(
      'Fetched %d candidate URLs for sync channel %s.',
      targetUrls.length,
      channel.Actor.preferredUsername,
      { targetUrls, ...lTags() }
    )

    if (targetUrls.length === 0) {
      if (channelSync) {
        channelSync.state = VideoChannelSyncState.SYNCED
        await channelSync.save()
      }

      return
    }

    const children: CreateJobArgument[] = []

    for (const targetUrl of targetUrls) {
      logger.debug(`Import candidate: ${targetUrl}`, lTags())

      try {
        if (await skipImport({ channel, channelSync, targetUrl, skipPublishedBefore })) continue

        const { job } = await buildYoutubeDLImport({
          user,
          channel,
          targetUrl,
          channelSync,
          importDataOverride: {
            privacy: VideoPrivacy.PUBLIC,
            support: channel.support
          }
        })

        children.push(job)
      } catch (err) {
        logger.error(`Cannot build import for ${targetUrl} in channel ${channel.name}`, { err, ...lTags() })
      }
    }

    // Will update the channel sync status
    const parent: CreateJobArgument = {
      type: 'after-video-channel-import',
      payload: {
        channelSyncId: channelSync?.id
      }
    }

    await JobQueue.Instance.createJobWithChildren(parent, children)
  } catch (err) {
    logger.error(`Failed to import ${externalChannelUrl} in channel ${channel.name}`, { err, ...lTags() })
    channelSync.state = VideoChannelSyncState.FAILED
    await channelSync.save()
  }
}

// ---------------------------------------------------------------------------

async function skipImport (options: {
  channel: MChannelAccountDefault
  channelSync: MChannelSync
  targetUrl: string
  skipPublishedBefore?: Date
}) {
  const { channel, channelSync, targetUrl, skipPublishedBefore } = options

  if (await VideoImportModel.urlAlreadyImported({ channelId: channel.id, channelSyncId: channelSync?.id, targetUrl })) {
    logger.debug(
      `${targetUrl} is already imported for channel ${channel.name}, skipping video channel synchronization.`,
      { channelSync, ...lTags() }
    )
    return true
  }

  if (skipPublishedBefore) {
    const youtubeDL = new YoutubeDLWrapper(
      targetUrl,
      ServerConfigManager.Instance.getEnabledResolutions('vod'),
      CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
    )

    const videoInfo = await youtubeDL.getInfoForDownload()

    const onlyAfterWithoutTime = new Date(skipPublishedBefore)
    onlyAfterWithoutTime.setHours(0, 0, 0, 0)

    if (videoInfo.originallyPublishedAtWithoutTime.getTime() < onlyAfterWithoutTime.getTime()) {
      return true
    }
  }

  return false
}
