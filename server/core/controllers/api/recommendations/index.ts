import express from 'express'
import { apiRateLimiter } from '@server/middlewares/index.js'
import { recommendationVideosRouter } from './recommendation-videos.js'

const recommendationsRouter = express.Router()

recommendationsRouter.use(apiRateLimiter)

recommendationsRouter.use('/', recommendationVideosRouter)

// ---------------------------------------------------------------------------

export {
  recommendationsRouter
}
