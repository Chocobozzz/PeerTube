import express, { Request, Response, NextFunction, RequestHandler } from 'express'
import { buildLogger } from '@server/helpers/logger.js'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { CONFIG } from '@server/initializers/config.js'
import { FileQuery, LogLevel, Uploadx, Metadata as UploadXMetadata } from '@uploadx/core'
import { extname } from 'path'
import { authenticate } from '@server/middlewares/auth.js'
import { resumableInitValidator } from '@server/middlewares/validators/resumable-upload.js'

const logger = buildLogger('uploadx')

export const uploadx = new Uploadx({
  directory: getResumableUploadPath(),

  expiration: { maxAge: undefined, rolling: true },

  // Could be big with thumbnails/previews
  maxMetadataSize: '10MB',

  logger: {
    logLevel: CONFIG.LOG.LEVEL as LogLevel,
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger)
  },

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

export function buildUploadXFile <T extends UploadXMetadata> (reqBody: T) {
  return {
    ...reqBody,

    path: getResumableUploadPath(reqBody.name),
    filename: reqBody.metadata.filename
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

  router.post(routePath,
    authenticate,
    ...uploadInitBeforeMiddlewares,
    resumableInitValidator,
    ...uploadInitAfterMiddlewares,
    (req, res) => uploadx.upload(req, res) // Prevent next() call, explicitly tell to uploadx it's the end
  )

  router.delete(routePath,
    authenticate,
    ...uploadDeleteMiddlewares,
    (req, res) => uploadx.upload(req, res) // Prevent next() call, explicitly tell to uploadx it's the end
  )

  router.put(routePath,
    authenticate,
    uploadx.upload, // uploadx doesn't next() before the file upload completes
    ...uploadedMiddlewares,
    uploadedController
  )
}
