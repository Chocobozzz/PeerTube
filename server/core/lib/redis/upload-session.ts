import { RESUMABLE_UPLOAD_SESSION_LIFETIME } from '../../initializers/constants.js'
import { deleteKey, setValueIfNotExists } from './redis-client.js'

// Atomic, so only one request (of any process) can process a completed upload
// Returns false if the upload is already being processed
export function startUploadSession (uploadId: string) {
  return setValueIfNotExists('resumable-upload-' + uploadId, '', RESUMABLE_UPLOAD_SESSION_LIFETIME)
}

export function deleteUploadSession (uploadId: string) {
  return deleteKey('resumable-upload-' + uploadId)
}
