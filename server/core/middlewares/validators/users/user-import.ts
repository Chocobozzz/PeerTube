import express from 'express'
import { body, header, param } from 'express-validator'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { uploadx } from '@server/lib/uploadx.js'
import { Metadata as UploadXMetadata } from '@uploadx/core'
import { logger } from '../../../helpers/logger.js'
import { areValidationErrors, checkUserIdExist } from '../shared/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { HttpStatusCode, ServerErrorCode, UserImportState, UserRight } from '@peertube/peertube-models'
import { isUserQuotaValid } from '@server/lib/user.js'
import { UserImportModel } from '@server/models/user/user-import.js'

export const userImportRequestResumableValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: express.CustomUploadXFile<UploadXMetadata> = req.body
    const file = { ...body, path: getResumableUploadPath(body.name), filename: body.metadata.filename }
    const cleanup = () => uploadx.storage.delete(file).catch(err => logger.error('Cannot delete the file %s', file.name, { err }))

    if (!await checkUserIdRight(req.params.userId, res)) return cleanup()

    if (CONFIG.IMPORT.USERS.ENABLED !== true) {
      res.fail({
        message: 'User import is not enabled by the administrator',
        status: HttpStatusCode.BAD_REQUEST_400
      })

      return cleanup()
    }

    res.locals.importUserFileResumable = { ...file, originalname: file.filename }

    return next()
  }
]

export const userImportRequestResumableInitValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  body('filename')
    .exists(),

  header('x-upload-content-length')
    .isNumeric()
    .exists()
    .withMessage('Should specify the file length'),
  header('x-upload-content-type')
    .isString()
    .exists()
    .withMessage('Should specify the file mimetype'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userImportRequestResumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers
    })

    if (areValidationErrors(req, res, { omitLog: true })) return

    if (CONFIG.IMPORT.USERS.ENABLED !== true) {
      return res.fail({
        message: 'User import is not enabled by the administrator',
        status: HttpStatusCode.BAD_REQUEST_400
      })
    }

    if (req.body.filename.endsWith('.zip') !== true) {
      return res.fail({
        message: 'User import file must be a zip',
        status: HttpStatusCode.BAD_REQUEST_400
      })
    }

    if (!await checkUserIdRight(req.params.userId, res)) return

    const user = res.locals.user
    if (await isUserQuotaValid({ userId: user.id, uploadSize: +req.headers['x-upload-content-length'] }) === false) {
      return res.fail({
        message: 'User video quota is exceeded with this import',
        status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
        type: ServerErrorCode.QUOTA_REACHED
      })
    }

    const userImport = await UserImportModel.loadLatestByUserId(user.id)
    if (userImport && userImport.state !== UserImportState.ERRORED && userImport.state !== UserImportState.COMPLETED) {
      return res.fail({
        message: 'An import is already being processed',
        status: HttpStatusCode.BAD_REQUEST_400
      })
    }

    return next()
  }
]

export const getLatestImportStatusValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!await checkUserIdRight(req.params.userId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkUserIdRight (userId: number | string, res: express.Response) {
  if (!await checkUserIdExist(userId, res)) return false

  const oauthUser = res.locals.oauth.token.User

  if (!oauthUser.hasRight(UserRight.MANAGE_USER_IMPORTS) && oauthUser.id !== res.locals.user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot manage imports of another user'
    })
    return false
  }

  return true
}
