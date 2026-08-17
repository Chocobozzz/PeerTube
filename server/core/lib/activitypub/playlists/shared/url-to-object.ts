import { PlaylistElementObject, PlaylistObject } from '@peertube/peertube-models'
import { isPlaylistElementObjectValid, isPlaylistObjectValid } from '@server/helpers/custom-validators/activitypub/playlist.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { createLogger } from '@server/helpers/logger.js'
import { fetchAP } from '../../activity.js'
import { checkUrlsSameHost } from '../../url.js'

const logger = createLogger('ap', 'playlist')

export async function fetchRemoteVideoPlaylist (playlistUrl: string): Promise<{ statusCode: number, playlistObject: PlaylistObject }> {
  logger.info('Fetching remote playlist %s.', playlistUrl)

  const { body, statusCode } = await fetchAP<any>(playlistUrl)

  if (isPlaylistObjectValid(body) === false || checkUrlsSameHost(body.id, playlistUrl) !== true) {
    logger.debug('Remote video playlist JSON is not valid.', { body })
    return { statusCode, playlistObject: undefined }
  }

  if (!isArray(body.to)) {
    logger.debug('Remote video playlist JSON does not have a valid audience.', { body })
    return { statusCode, playlistObject: undefined }
  }

  return { statusCode, playlistObject: body }
}

export async function fetchRemotePlaylistElement (
  elementUrl: string
): Promise<{ statusCode: number, elementObject: PlaylistElementObject }> {
  logger.debug('Fetching remote playlist element %s.', elementUrl)

  const { body, statusCode } = await fetchAP<PlaylistElementObject>(elementUrl)

  if (!isPlaylistElementObjectValid(body)) throw new Error(`Invalid body in fetch playlist element ${elementUrl}`)

  if (checkUrlsSameHost(body.id, elementUrl) !== true) {
    throw new Error(`Playlist element url ${elementUrl} host is different from the AP object id ${body.id}`)
  }

  return { statusCode, elementObject: body }
}
