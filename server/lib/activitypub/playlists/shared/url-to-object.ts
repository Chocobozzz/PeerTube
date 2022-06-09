import { isArray } from 'lodash'
import { checkUrlsSameHost } from '@server/helpers/activitypub'
import { isPlaylistElementObjectValid, isPlaylistObjectValid } from '@server/helpers/custom-validators/activitypub/playlist'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { doJSONRequest } from '@server/helpers/requests'
import { PlaylistElementObject, PlaylistObject } from '@shared/models'

async function fetchRemoteVideoPlaylist (playlistUrl: string): Promise<{ statusCode: number, playlistObject: PlaylistObject }> {
  const lTags = loggerTagsFactory('ap', 'video-playlist', playlistUrl)

  logger.info('Fetching remote playlist %s.', playlistUrl, lTags())

  const { body, statusCode } = await doJSONRequest<any>(playlistUrl, { activityPub: true })

  if (isPlaylistObjectValid(body) === false || checkUrlsSameHost(body.id, playlistUrl) !== true) {
    logger.debug('Remote video playlist JSON is not valid.', { body, ...lTags() })
    return { statusCode, playlistObject: undefined }
  }

  if (!isArray(body.to)) {
    logger.debug('Remote video playlist JSON does not have a valid audience.', { body, ...lTags() })
    return { statusCode, playlistObject: undefined }
  }

  return { statusCode, playlistObject: body }
}

async function fetchRemotePlaylistElement (elementUrl: string): Promise<{ statusCode: number, elementObject: PlaylistElementObject }> {
  const lTags = loggerTagsFactory('ap', 'video-playlist', 'element', elementUrl)

  logger.debug('Fetching remote playlist element %s.', elementUrl, lTags())

  const { body, statusCode } = await doJSONRequest<PlaylistElementObject>(elementUrl, { activityPub: true })

  if (!isPlaylistElementObjectValid(body)) throw new Error(`Invalid body in fetch playlist element ${elementUrl}`)

  if (checkUrlsSameHost(body.id, elementUrl) !== true) {
    throw new Error(`Playlist element url ${elementUrl} host is different from the AP object id ${body.id}`)
  }

  return { statusCode, elementObject: body }
}

export {
  fetchRemoteVideoPlaylist,
  fetchRemotePlaylistElement
}
