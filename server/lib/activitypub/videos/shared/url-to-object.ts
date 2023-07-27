import { sanitizeAndCheckVideoTorrentObject } from '@server/helpers/custom-validators/activitypub/videos'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { VideoObject } from '@shared/models'
import { fetchAP } from '../../activity'
import { checkUrlsSameHost } from '../../url'

const lTags = loggerTagsFactory('ap', 'video')

async function fetchRemoteVideo (videoUrl: string): Promise<{ statusCode: number, videoObject: VideoObject }> {
  logger.info('Fetching remote video %s.', videoUrl, lTags(videoUrl))

  const { statusCode, body } = await fetchAP<any>(videoUrl)

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body, ...lTags(videoUrl) })

    return { statusCode, videoObject: undefined }
  }

  return { statusCode, videoObject: body }
}

export {
  fetchRemoteVideo
}
