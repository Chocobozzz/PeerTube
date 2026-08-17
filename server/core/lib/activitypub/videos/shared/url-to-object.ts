import { VideoObject } from '@peertube/peertube-models'
import { sanitizeAndCheckVideoTorrentObject } from '@server/helpers/custom-validators/activitypub/videos.js'
import { createLogger } from '@server/helpers/logger.js'
import { fetchAP } from '../../activity.js'
import { checkUrlsSameHost } from '../../url.js'

const logger = createLogger('ap', 'video')

export async function fetchRemoteVideo (videoUrl: string): Promise<{ statusCode: number, videoObject: VideoObject }> {
  logger.info('Fetching remote video %s.', videoUrl)

  const { statusCode, body } = await fetchAP<any>(videoUrl)

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body })

    return { statusCode, videoObject: undefined }
  }

  return { statusCode, videoObject: body }
}
