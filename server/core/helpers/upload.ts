import { join } from 'path'
import { DIRECTORIES } from '@server/initializers/constants.js'

function getResumableUploadPath (filename?: string) {
  if (filename) return join(DIRECTORIES.RESUMABLE_UPLOAD, filename)

  return DIRECTORIES.RESUMABLE_UPLOAD
}

// ---------------------------------------------------------------------------

export {
  getResumableUploadPath
}
