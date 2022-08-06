import { UserModel } from '@server/models/user/user'
import { VideoImportModel } from '@server/models/video/video-import'
import { wait } from '@shared/core-utils'
import { addYoutubeDLImport } from '@server/lib/video-import'
import { YoutubeDLCLI } from '@server/helpers/youtube-dl'
import { logger } from '@server/helpers/logger'
import { VideoPrivacy } from '@shared/models'
import { MChannelAccountDefault } from '@server/types/models'

type ChannelSyncInfo = {
  total: number
  alreadyImported: number
  errors: number
  successes: number
}

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

export type SynchronizeChannelOptions = {
  youtubeDL: YoutubeDLCLI
  secondsToWait: number
  lastVideosCount?: number
  onlyAfter?: Date
}

function formatDateForYoutubeDl (date: Date) {
  return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(date.getDate()).toString().padStart(2, '0')}`
}

export async function synchronizeChannel (
  channel: MChannelAccountDefault,
  externalChannelUrl: string,
  { youtubeDL, secondsToWait, lastVideosCount, onlyAfter }: SynchronizeChannelOptions
): Promise<ChannelSyncInfo> {
  const user = await UserModel.loadByChannelActorId(channel.actorId)
  const channelInfo = await youtubeDL.getChannelInfo({
    lastVideosCount,
    channelUrl: externalChannelUrl,
    processOptions
  })
  const afterFormatted: string = onlyAfter && formatDateForYoutubeDl(onlyAfter)
  const targetUrls: string[] = (await Promise.all(
    channelInfo.map(video => {
      if (afterFormatted && video['upload_date'] <= afterFormatted) {
        return []
      }
      return video['webpage_url']
    })
  )).flat()
  logger.debug('Fetched %d candidate URLs for upload: %j', targetUrls.length, targetUrls)

  await wait(secondsToWait * 1000)

  const result: ChannelSyncInfo = {
    total: 0,
    errors: 0,
    successes: 0,
    alreadyImported: targetUrls.length
  }

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
    } catch (err) {
      result.errors += 1
      logger.error(`An error occured while importing ${targetUrl}`, { err })
    }
    await wait(secondsToWait * 1000)
  }
  return result
}
