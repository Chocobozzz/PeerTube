import { logger } from '@server/helpers/logger'
import { YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { buildYoutubeDLImport } from '@server/lib/video-import'
import { UserModel } from '@server/models/user/user'
import { VideoImportModel } from '@server/models/video/video-import'
import { MChannelAccountDefault, MChannelSync } from '@server/types/models'
import { VideoChannelSyncState, VideoPrivacy } from '@shared/models'
import { CreateJobArgument, JobQueue } from './job-queue'
import { ServerConfigManager } from './server-config-manager'

export async function synchronizeChannel (options: {
  channel: MChannelAccountDefault
  externalChannelUrl: string
  channelSync?: MChannelSync
  videosCountLimit?: number
  onlyAfter?: Date
}) {
  const { channel, externalChannelUrl, videosCountLimit, onlyAfter, channelSync } = options

  const user = await UserModel.loadByChannelActorId(channel.actorId)
  const youtubeDL = new YoutubeDLWrapper(
    externalChannelUrl,
    ServerConfigManager.Instance.getEnabledResolutions('vod'),
    CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
  )

  const infoList = await youtubeDL.getInfoForListImport({ latestVideosCount: videosCountLimit })

  const targetUrls = infoList
    .filter(videoInfo => {
      if (!onlyAfter) return true

      return videoInfo.originallyPublishedAt.getTime() >= onlyAfter.getTime()
    })
    .map(videoInfo => videoInfo.webpageUrl)

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
    if (await VideoImportModel.urlAlreadyImported(channel.id, targetUrl)) {
      logger.debug('%s is already imported for channel %s, skipping video channel synchronization.', channel.name, targetUrl)
      continue
    }

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

  const parent: CreateJobArgument = {
    type: 'after-video-channel-import',
    payload: {
      channelSyncId: channelSync?.id
    }
  }

  await JobQueue.Instance.createJobWithChildren(parent, children)
}
