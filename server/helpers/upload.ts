import { JobQueue } from '@server/lib/job-queue'
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

function scheduleDeleteResumableUploadMetaFile (filepath: string) {
  const payload = { filepath }
  JobQueue.Instance.createJob({ type: 'delete-resumable-upload-meta-file', payload }, { delay: 900 * 1000 }) // executed in 15 min
}

// ---------------------------------------------------------------------------

export {
  getResumableUploadPath,
  deleteResumableUploadMetaFile,
  scheduleDeleteResumableUploadMetaFile
}
