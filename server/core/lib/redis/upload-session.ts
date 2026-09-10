import { RESUMABLE_UPLOAD_SESSION_LIFETIME } from '../../initializers/constants.js'
import { deleteKey, keyExists, setValue } from './redis-client.js'

export function setUploadSession (uploadId: string) {
  return setValue('resumable-upload-' + uploadId, '', RESUMABLE_UPLOAD_SESSION_LIFETIME)
}

export function doesUploadSessionExist (uploadId: string) {
  return keyExists('resumable-upload-' + uploadId)
}

export function deleteUploadSession (uploadId: string) {
  return deleteKey('resumable-upload-' + uploadId)
}
