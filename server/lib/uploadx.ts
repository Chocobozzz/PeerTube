import express from 'express'
import { buildLogger } from '@server/helpers/logger'
import { getResumableUploadPath } from '@server/helpers/upload'
import { Uploadx } from '@uploadx/core'

const uploadx = new Uploadx({
  directory: getResumableUploadPath(),

  expiration: { maxAge: undefined, rolling: true },

  // Could be big with thumbnails/previews
  maxMetadataSize: '10MB',

  logger: buildLogger('uploadx'),

  userIdentifier: (_, res: express.Response) => {
    if (!res.locals.oauth) return undefined

    return res.locals.oauth.token.user.id + ''
  }
})

export {
  uploadx
}
