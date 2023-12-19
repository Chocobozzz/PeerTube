import { CONFIG } from '@server/initializers/config.js'
import { MStreamingPlaylistVideo, MVideoFile } from '@server/types/models/index.js'
import { generateHLSObjectStorageKey, generateWebVideoObjectStorageKey } from './keys.js'
import { buildKey, getClient } from './shared/index.js'
import { getHLSPublicFileUrl, getWebVideoPublicFileUrl } from './urls.js'

export async function generateWebVideoPresignedUrl (options: {
  file: MVideoFile
  downloadFilename: string
}) {
  const { file, downloadFilename } = options

  const key = generateWebVideoObjectStorageKey(file.filename)

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

  const command = new GetObjectCommand({
    Bucket: CONFIG.OBJECT_STORAGE.WEB_VIDEOS.BUCKET_NAME,
    Key: buildKey(key, CONFIG.OBJECT_STORAGE.WEB_VIDEOS),
    ResponseContentDisposition: `attachment; filename=${encodeURI(downloadFilename)}`
  })

  const url = await getSignedUrl(await getClient(), command, { expiresIn: 3600 * 24 })

  return getWebVideoPublicFileUrl(url)
}

export async function generateHLSFilePresignedUrl (options: {
  streamingPlaylist: MStreamingPlaylistVideo
  file: MVideoFile
  downloadFilename: string
}) {
  const { streamingPlaylist, file, downloadFilename } = options

  const key = generateHLSObjectStorageKey(streamingPlaylist, file.filename)

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

  const command = new GetObjectCommand({
    Bucket: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BUCKET_NAME,
    Key: buildKey(key, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS),
    ResponseContentDisposition: `attachment; filename=${encodeURI(downloadFilename)}`
  })

  const url = await getSignedUrl(await getClient(), command, { expiresIn: 3600 * 24 })

  return getHLSPublicFileUrl(url)
}
