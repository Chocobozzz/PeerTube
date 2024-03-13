import express from 'express'
import { param } from 'express-validator'
import { buildUploadXFile, safeUploadXCleanup } from '@server/lib/uploadx.js'
import { Metadata as UploadXMetadata } from '@uploadx/core'
import { areValidationErrors, checkUserIdExist } from '../shared/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { HttpStatusCode, ServerErrorCode, UserImportState, UserRight } from '@peertube/peertube-models'
import { isUserQuotaValid } from '@server/lib/user.js'
import { UserImportModel } from '@server/models/user/user-import.js'

export const userImportRequestResumableValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const file = buildUploadXFile(req.body as express.CustomUploadXFile<UploadXMetadata>)
    const cleanup = () => safeUploadXCleanup(file)

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

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

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

    const fileMetadata = res.locals.uploadVideoFileResumableMetadata
    const user = res.locals.user
    if (await isUserQuotaValid({ userId: user.id, uploadSize: fileMetadata.size }) === false) {
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
