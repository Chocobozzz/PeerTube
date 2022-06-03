import { join } from 'path'
import { RESUMABLE_UPLOAD_DIRECTORY } from '../initializers/constants'

function getResumableUploadPath (filename?: string) {
  if (filename) return join(RESUMABLE_UPLOAD_DIRECTORY, filename)

  return RESUMABLE_UPLOAD_DIRECTORY
}

// ---------------------------------------------------------------------------

export {
  getResumableUploadPath
}
