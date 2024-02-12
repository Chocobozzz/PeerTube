import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode, ServerErrorCode, UserExportRequest, UserExportState, UserRight } from '@peertube/peertube-models'
import { areValidationErrors, checkUserIdExist } from '../shared/index.js'
import { isBooleanValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { UserExportModel } from '@server/models/user/user-export.js'
import { MUserExport } from '@server/types/models/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { getOriginalVideoFileTotalFromUser } from '@server/lib/user.js'

export const userExportsListValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!ensureExportIsEnabled(res)) return
    if (!await checkUserIdRight(req.params.userId, res)) return

    return next()
  }
]

export const userExportRequestValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  body('withVideoFiles')
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have withVideoFiles boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!ensureExportIsEnabled(res)) return
    if (!await checkUserIdRight(req.params.userId, res)) return

    // Check not already created
    const exportsList = await UserExportModel.listByUser(res.locals.user)
    if (exportsList.filter(e => e.state !== UserExportState.ERRORED).length !== 0) {
      return res.fail({
        message: 'User has already processing or completed exports'
      })
    }

    const body: UserExportRequest = req.body

    if (body.withVideoFiles) {
      const quota = await getOriginalVideoFileTotalFromUser(res.locals.user)

      if (quota > CONFIG.EXPORT.USERS.MAX_USER_VIDEO_QUOTA) {
        return res.fail({
          message: 'User video quota exceeds the maximum limit set by the admin to create a user archive containing videos',
          type: ServerErrorCode.MAX_USER_VIDEO_QUOTA_EXCEEDED_FOR_USER_EXPORT,
          status: HttpStatusCode.FORBIDDEN_403
        })
      }
    }

    return next()
  }
]

export const userExportDeleteValidator = [
  param('userId')
    .isInt().not().isEmpty().withMessage('Should have a valid userId'),

  param('id')
    .isInt().not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!ensureExportIsEnabled(res)) return
    if (!await checkUserIdRight(req.params.userId, res)) return

    const userExport = await UserExportModel.load(req.params.id + '')
    if (!userExport) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (!checkUserExportRight(userExport, res)) return

    if (!userExport.canBeSafelyRemoved()) {
      return res.fail({
        message: 'Cannot delete this user export because its state is not compatible with a deletion'
      })
    }

    res.locals.userExport = userExport

    return next()
  }
]

export const userExportDownloadValidator = [
  param('filename').exists(),

  query('jwt').isJWT(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!ensureExportIsEnabled(res)) return

    const userExport = await UserExportModel.loadByFilename(req.params.filename)
    if (!userExport) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (userExport.isJWTValid(req.query.jwt) !== true) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    res.locals.userExport = userExport

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkUserIdRight (userId: number | string, res: express.Response) {
  if (!await checkUserIdExist(userId, res)) return false

  const oauthUser = res.locals.oauth.token.User

  if (!oauthUser.hasRight(UserRight.MANAGE_USER_EXPORTS) && oauthUser.id !== res.locals.user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot manage exports of another user'
    })
    return false
  }

  return true
}

function checkUserExportRight (userExport: MUserExport, res: express.Response) {
  if (userExport.userId !== res.locals.user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Export is not associated to this user'
    })
    return false
  }

  return true
}

function ensureExportIsEnabled (res: express.Response) {
  if (CONFIG.EXPORT.USERS.ENABLED !== true) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'User export is disabled on this instance'
    })

    return false
  }

  return true
}
