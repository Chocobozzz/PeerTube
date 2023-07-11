import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { CONFIG } from '@server/initializers/config'
import { MStreamingPlaylistVideo, MVideoFile } from '@server/types/models'
import { generateHLSObjectStorageKey, generateWebVideoObjectStorageKey } from './keys'
import { buildKey, getClient } from './shared'
import { getHLSPublicFileUrl, getWebVideoPublicFileUrl } from './urls'

export async function generateWebVideoPresignedUrl (options: {
  file: MVideoFile
  downloadFilename: string
}) {
  const { file, downloadFilename } = options

  const key = generateWebVideoObjectStorageKey(file.filename)

  const command = new GetObjectCommand({
    Bucket: CONFIG.OBJECT_STORAGE.WEB_VIDEOS.BUCKET_NAME,
    Key: buildKey(key, CONFIG.OBJECT_STORAGE.WEB_VIDEOS),
    ResponseContentDisposition: `attachment; filename=${downloadFilename}`
  })

  const url = await getSignedUrl(getClient(), command, { expiresIn: 3600 * 24 })

  return getWebVideoPublicFileUrl(url)
}

export async function generateHLSFilePresignedUrl (options: {
  streamingPlaylist: MStreamingPlaylistVideo
  file: MVideoFile
  downloadFilename: string
}) {
  const { streamingPlaylist, file, downloadFilename } = options

  const key = generateHLSObjectStorageKey(streamingPlaylist, file.filename)

  const command = new GetObjectCommand({
    Bucket: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BUCKET_NAME,
    Key: buildKey(key, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS),
    ResponseContentDisposition: `attachment; filename=${downloadFilename}`
  })

  const url = await getSignedUrl(getClient(), command, { expiresIn: 3600 * 24 })

  return getHLSPublicFileUrl(url)
}
