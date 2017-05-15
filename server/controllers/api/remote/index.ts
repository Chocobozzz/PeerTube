import express = require('express')

import { badRequest } from '../../../helpers'

import { remotePodsRouter } from './pods'
import { remoteVideosRouter } from './videos'

const remoteRouter = express.Router()

remoteRouter.use('/pods', remotePodsRouter)
remoteRouter.use('/videos', remoteVideosRouter)
remoteRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export {
  remoteRouter
}
