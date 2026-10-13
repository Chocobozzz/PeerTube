import { getLowercaseExtension } from '@peertube/peertube-node-utils'
import { DIRECTORIES, MIMETYPES } from '@server/initializers/constants.js'
import { join } from 'path'
import { isVideoFileExtnameValid } from './custom-validators/videos.js'
import { getExtFromMimetype } from './video.js'

export function getResumableUploadPath (filename?: string) {
  if (filename) return join(DIRECTORIES.RESUMABLE_UPLOAD, filename)

  return DIRECTORIES.RESUMABLE_UPLOAD
}

// Extension of a resumable video upload file (on disk, or downloaded from object storage staging)
// Like legacy uploads: it comes from the mimetype, or from the client filename if we don't know the mimetype
// Never keep an extension that is not a video one: FFmpeg picks some demuxers from it (HLS playlist...)
// Without extension, FFmpeg detects the format from the content
export function buildVideoUploadFileExtension (options: { filename: string, mimetype: string }) {
  const fromMimetype = getExtFromMimetype(MIMETYPES.VIDEO.MIMETYPE_EXT, options.mimetype)
  if (fromMimetype) return fromMimetype

  const fromFilename = getLowercaseExtension(options.filename)
  if (isVideoFileExtnameValid(fromFilename)) return fromFilename

  return ''
}
