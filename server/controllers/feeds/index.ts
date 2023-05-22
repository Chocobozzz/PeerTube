import express from 'express'
import { commentFeedsRouter } from './comment-feeds'
import { videoFeedsRouter } from './video-feeds'
import { videoPodcastFeedsRouter } from './video-podcast-feeds'

const feedsRouter = express.Router()

feedsRouter.use('/', commentFeedsRouter)
feedsRouter.use('/', videoFeedsRouter)
feedsRouter.use('/', videoPodcastFeedsRouter)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}
