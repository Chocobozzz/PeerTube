import { FileStorageType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { ModelCache } from '@server/models/shared/model-cache.js'
import { moveCommonFile } from './move-common-file.js'

const logger = createLogger()

export async function moveUploadImageToStorage (options: {
  uploadImageId: number
  targetStorage: FileStorageType
}) {
  const { uploadImageId, targetStorage } = options

  const image = await UploadImageModel.findByPk(uploadImageId)

  if (!image) {
    logger.info(`Can't process upload image ${uploadImageId}, image does not exist anymore.`)
    return
  }

  if (!image.isLocal() || image.storage === targetStorage) {
    logger.info(`No file to move for upload image ${uploadImageId}.`)
    return
  }

  // Upload images are not federated, so there is nothing to send after the move
  const moved = await moveCommonFile({ type: 'uploads', filename: image.filename, fsPath: image.getFSPath(), targetStorage })

  // Upload images belong to the server actor, that caches them: their URL just changed
  if (moved) ModelCache.Instance.clearCache('server-account')
}
