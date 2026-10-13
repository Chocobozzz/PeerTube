import { MIMETYPES } from '@server/initializers/constants.js'
import { extname } from 'path'

export function getObjectStorageContentType (filename: string) {
  if (filename.endsWith('.m3u8')) {
    return 'application/x-mpegURL; charset=utf-8'
  }

  if (filename.endsWith('.json')) {
    return 'application/json; charset=utf-8'
  }

  if (filename.endsWith('.vtt')) {
    return 'text/vtt; charset=utf-8'
  }

  if (filename.endsWith('.torrent')) {
    return 'application/x-bittorrent'
  }

  const ext = extname(filename).toLowerCase()

  // LOGO_IMAGE is a superset of IMAGE that also contains SVG
  return MIMETYPES.LOGO_IMAGE.EXT_MIMETYPE[ext] ||
    MIMETYPES.VIDEO.EXT_MIMETYPE[ext] ||
    MIMETYPES.AUDIO.EXT_MIMETYPE[ext]
}
