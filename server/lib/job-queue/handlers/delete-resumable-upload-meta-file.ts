import * as Bull from 'bull'
import { DeleteResumableUploadMetaFilePayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { deleteResumableUploadMetaFile } from '@server/helpers/upload'

async function processDeleteResumableUploadMetaFile (job: Bull.Job) {
  const payload = job.data as DeleteResumableUploadMetaFilePayload
  logger.info('Processing deletion of meta file for resumable upload in job %d.', job.id)

  await deleteResumableUploadMetaFile(payload.filepath)
}

// ---------------------------------------------------------------------------

export {
  processDeleteResumableUploadMetaFile
}
