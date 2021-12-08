import express from 'express'
import { getResumableUploadPath } from '@server/helpers/upload'
import { Uploadx } from '@uploadx/core'

const uploadx = new Uploadx({ directory: getResumableUploadPath() })
uploadx.getUserId = (_, res: express.Response) => res.locals.oauth?.token.user.id

export {
  uploadx
}
