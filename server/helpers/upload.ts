import { METAFILE_EXTNAME } from '@uploadx/core'
import { remove } from 'fs-extra'
import { join } from 'path'
import { RESUMABLE_UPLOAD_DIRECTORY } from '../initializers/constants'

function getResumableUploadPath (filename?: string) {
  if (filename) return join(RESUMABLE_UPLOAD_DIRECTORY, filename)

  return RESUMABLE_UPLOAD_DIRECTORY
}

function deleteResumableUploadMetaFile (filepath: string) {
  return remove(filepath + METAFILE_EXTNAME)
}

// ---------------------------------------------------------------------------

export {
  getResumableUploadPath,
  deleteResumableUploadMetaFile
}
