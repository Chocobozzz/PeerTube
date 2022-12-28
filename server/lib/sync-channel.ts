import { logger } from '@server/helpers/logger'
import { YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { buildYoutubeDLImport } from '@server/lib/video-pre-import'
import { UserModel } from '@server/models/user/user'
import { VideoImportModel } from '@server/models/video/video-import'
import { MChannel, MChannelAccountDefault, MChannelSync } from '@server/types/models'
import { VideoChannelSyncState, VideoPrivacy } from '@shared/models'
import { CreateJobArgument, JobQueue } from './job-queue'
import { ServerConfigManager } from './server-config-manager'

export async function synchronizeChannel (options: {
  channel: MChannelAccountDefault
  externalChannelUrl: string
  videosCountLimit: number
  channelSync?: MChannelSync
  onlyAfter?: Date
}) {
  const { channel, externalChannelUrl, videosCountLimit, onlyAfter, channelSync } = options

  if (channelSync) {
    channelSync.state = VideoChannelSyncState.PROCESSING
    channelSync.lastSyncAt = new Date()
    await channelSync.save()
  }

  try {
    const user = await UserModel.loadByChannelActorId(channel.actorId)
    const youtubeDL = new YoutubeDLWrapper(
      externalChannelUrl,
      ServerConfigManager.Instance.getEnabledResolutions('vod'),
      CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
    )

    const targetUrls = await youtubeDL.getInfoForListImport({ latestVideosCount: videosCountLimit })

    logger.info(
      'Fetched %d candidate URLs for sync channel %s.',
      targetUrls.length, channel.Actor.preferredUsername, { targetUrls }
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
      if (await skipImport(channel, targetUrl, onlyAfter)) continue

      const { job } = await buildYoutubeDLImport({
        user,
        channel,
        targetUrl,
        channelSync,
        importDataOverride: {
          privacy: VideoPrivacy.PUBLIC
        }
      })

      children.push(job)
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
    logger.error(`Failed to import ${externalChannelUrl} in channel ${channel.name}`, { err })
    channelSync.state = VideoChannelSyncState.FAILED
    await channelSync.save()
  }
}

// ---------------------------------------------------------------------------

async function skipImport (channel: MChannel, targetUrl: string, onlyAfter?: Date) {
  if (await VideoImportModel.urlAlreadyImported(channel.id, targetUrl)) {
    logger.debug('%s is already imported for channel %s, skipping video channel synchronization.', targetUrl, channel.name)
    return true
  }

  if (onlyAfter) {
    const youtubeDL = new YoutubeDLWrapper(
      targetUrl,
      ServerConfigManager.Instance.getEnabledResolutions('vod'),
      CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
    )

    const videoInfo = await youtubeDL.getInfoForDownload()

    const onlyAfterWithoutTime = new Date(onlyAfter)
    onlyAfterWithoutTime.setHours(0, 0, 0, 0)

    if (videoInfo.originallyPublishedAtWithoutTime.getTime() < onlyAfterWithoutTime.getTime()) {
      return true
    }
  }

  return false
}
