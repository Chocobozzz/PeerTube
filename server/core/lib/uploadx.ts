import { install } from '@logtape/adaptor-winston'
import { buildWinstonLogger } from '@server/helpers/logger.js'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { authenticate } from '@server/middlewares/auth.js'
import { resumableInitValidator } from '@server/middlewares/validators/resumable-upload.js'
import { FileQuery, Uploadx, Metadata as UploadXMetadata } from '@uploadx/core'
import express, { NextFunction, Request, RequestHandler, Response } from 'express'
import { extname } from 'path'

const logger = buildWinstonLogger({ labelSuffix: 'uploadx' })
install(logger)

export const uploadx = new Uploadx({
  directory: getResumableUploadPath(),

  expiration: { maxAge: undefined, rolling: true },

  // Could be big with a big thumbnail
  maxMetadataSize: '10MB',

  userIdentifier: (_, res: express.Response) => {
    if (!res.locals.oauth) return undefined

    return res.locals.oauth.token.user.id + ''
  },

  filename: file => `${file.userId}-${file.id}${extname(file.metadata.filename)}`
})

export function safeUploadXCleanup (file: FileQuery) {
  uploadx.storage.delete(file)
    .catch(err => logger.error('Cannot delete the file %s', file.name, { err }))
}

export function buildUploadXFile<T extends UploadXMetadata> (reqBody: T) {
  return {
    // oxlint-disable-next-line @typescript-eslint/no-misused-spread
    ...reqBody,

    path: getResumableUploadPath(reqBody.name),
    filename: reqBody.metadata.filename,
    originalname: reqBody.originalName
  }
}

export function setupUploadResumableRoutes (options: {
  router: express.Router
  routePath: string

  uploadInitBeforeMiddlewares?: RequestHandler[]
  uploadInitAfterMiddlewares?: RequestHandler[]

  uploadedMiddlewares?: ((req: Request<any>, res: Response, next: NextFunction) => void)[]
  uploadedController: (req: Request<any>, res: Response, next: NextFunction) => void

  uploadDeleteMiddlewares?: RequestHandler[]
}) {
  const {
    router,
    routePath,
    uploadedMiddlewares = [],
    uploadedController,
    uploadInitBeforeMiddlewares = [],
    uploadInitAfterMiddlewares = [],
    uploadDeleteMiddlewares = []
  } = options

  router.post(
    routePath,
    authenticate,
    ...uploadInitBeforeMiddlewares,
    resumableInitValidator,
    ...uploadInitAfterMiddlewares,
    // Prevent next() call, explicitly tell to uploadx it's the end
    (req, res) => uploadx.upload(req, res)
  )

  router.delete(
    routePath,
    authenticate,
    ...uploadDeleteMiddlewares,
    // Prevent next() call, explicitly tell to uploadx it's the end
    (req, res) => uploadx.upload(req, res)
  )

  router.put(
    routePath,
    authenticate,
    uploadx.upload, // uploadx doesn't next() before the file upload completes
    ...uploadedMiddlewares,
    uploadedController
  )
}
