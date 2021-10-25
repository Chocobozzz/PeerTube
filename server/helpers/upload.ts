import { join } from 'path'
import { JobQueue } from '@server/lib/job-queue'
import { RESUMABLE_UPLOAD_DIRECTORY } from '../initializers/constants'

function getResumableUploadPath (filename?: string) {
  if (filename) return join(RESUMABLE_UPLOAD_DIRECTORY, filename)

  return RESUMABLE_UPLOAD_DIRECTORY
}

function scheduleDeleteResumableUploadMetaFile (filepath: string) {
  const payload = { filepath }
  JobQueue.Instance.createJob({ type: 'delete-resumable-upload-meta-file', payload }, { delay: 900 * 1000 }) // executed in 15 min
}

// ---------------------------------------------------------------------------

export {
  getResumableUploadPath,
  scheduleDeleteResumableUploadMetaFile
}
