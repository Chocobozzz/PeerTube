import { checkUrlsSameHost } from '@server/helpers/activitypub'
import { sanitizeAndCheckVideoTorrentObject } from '@server/helpers/custom-validators/activitypub/videos'
import { logger } from '@server/helpers/logger'
import { doJSONRequest } from '@server/helpers/requests'
import { VideoObject } from '@shared/models'

async function fetchRemoteVideo (videoUrl: string): Promise<{ statusCode: number, videoObject: VideoObject }> {
  logger.info('Fetching remote video %s.', videoUrl)

  const { statusCode, body } = await doJSONRequest<any>(videoUrl, { activityPub: true })

  if (sanitizeAndCheckVideoTorrentObject(body) === false || checkUrlsSameHost(body.id, videoUrl) !== true) {
    logger.debug('Remote video JSON is not valid.', { body })
    return { statusCode, videoObject: undefined }
  }

  return { statusCode, videoObject: body }
}

export {
  fetchRemoteVideo
}
