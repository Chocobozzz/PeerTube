import { VideoChannelSyncState } from '@peertube/peertube-models'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger.js'
import { YoutubeDlImportError, YoutubeDlImportErrorCode, YoutubeDLWrapper } from '@server/helpers/youtube-dl/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildYoutubeDLImport } from '@server/lib/video-pre-import.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { MChannelAccountDefault, MChannelSync } from '@server/types/models/index.js'
import { CreateJobArgument, JobQueue } from './job-queue/index.js'
import { ServerConfigManager } from './server-config-manager.js'
import { buildRetryImportJob } from './video-post-import.js'
import { getLeastPrivatePrivacy } from './video.js'

const rootLTags = loggerTagsFactory('channel-synchronization')

export async function synchronizeChannel (options: {
  channel: MChannelAccountDefault
  externalChannelUrl: string
  videosCountLimit: number
  channelSync?: MChannelSync
  skipPublishedBeforeOrEq?: Date
}) {
  const { channel, externalChannelUrl, videosCountLimit, skipPublishedBeforeOrEq, channelSync } = options
  const channelUsername = channel.Actor.preferredUsername

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

    const lTags = loggerTagsFactory(...rootLTags().tags, channelSync.externalChannelUrl, channelUsername)

    const targetUrls = await youtubeDL.getInfoForListImport({
      userLanguage: user.getLanguage(),
      latestVideosCount: videosCountLimit
    })

    logger.info(
      `Fetched ${targetUrls.length} candidate URLs for sync channel ${channelSync.externalChannelUrl}.`,
      { targetUrls, ...lTags() }
    )

    const children: CreateJobArgument[] = []

    let buildJobErrors = 0

    for (const targetUrl of targetUrls) {
      logger.debug(`Import candidate: ${targetUrl}`, lTags())

      try {
        if (await skipImport({ channel, channelSync, targetUrl, lTags })) continue

        const { job } = await buildYoutubeDLImport({
          user,
          channel,
          targetUrl,
          channelSync,
          skipPublishedBeforeOrEq,
          importDataOverride: {
            privacy: getLeastPrivatePrivacy(),
            support: channel.support
          }
        })

        children.push(job)
      } catch (err) {
        if (err instanceof YoutubeDlImportError) {
          if (
            err.code === YoutubeDlImportErrorCode.SKIP_PUBLICATION_DATE ||
            err.code === YoutubeDlImportErrorCode.IS_LIVE ||
            err.isUnavailableVideoError()
          ) {
            continue
          }

          if (err.isRateLimitError()) {
            logger.info(`Stopping synchronization due to rate limit error in channel ${channelUsername}.`, { err, ...lTags() })
            break
          }
        }

        buildJobErrors++

        logger.error(`Cannot build import for ${targetUrl} in channel ${channelUsername}`, { err, ...lTags() })
      }
    }

    const failed = await VideoImportModel.listFailedBySyncId({ channelSyncId: channelSync.id })
    for (const videoImport of failed) {
      logger.info(
        `Retrying failed video import (id: ${videoImport.id}) for channel "${channel.Actor.preferredUsername}"`,
        rootLTags()
      )

      children.push(await buildRetryImportJob(videoImport))
    }

    // Will update the channel sync status
    const parent: CreateJobArgument = {
      type: 'after-video-channel-import',
      payload: {
        channelSyncId: channelSync?.id,
        buildJobErrors
      }
    }

    await JobQueue.Instance.createJobWithChildren(parent, children)
  } catch (err) {
    logger.error(`Failed to import ${externalChannelUrl} in channel ${channelUsername}`, { err, ...rootLTags() })
    channelSync.state = VideoChannelSyncState.FAILED
    await channelSync.save()
  }
}

// ---------------------------------------------------------------------------

async function skipImport (options: {
  channel: MChannelAccountDefault
  channelSync: MChannelSync
  targetUrl: string
  lTags: LoggerTagsFn
}) {
  const { channel, channelSync, targetUrl, lTags } = options

  if (await VideoImportModel.urlAlreadyImported({ channelId: channel.id, channelSyncId: channelSync?.id, targetUrl })) {
    logger.debug(
      `${targetUrl} is already imported for channel ${channel.name}, skipping video channel synchronization.`,
      { channelSync, ...lTags() }
    )

    return true
  }

  return false
}
