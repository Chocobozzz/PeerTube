import express from 'express'
import { buildLogger } from '@server/helpers/logger'
import { getResumableUploadPath } from '@server/helpers/upload'
import { CONFIG } from '@server/initializers/config'
import { LogLevel, Uploadx } from '@uploadx/core'
import { extname } from 'path'

const logger = buildLogger('uploadx')

const uploadx = new Uploadx({
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

export {
  uploadx
}
