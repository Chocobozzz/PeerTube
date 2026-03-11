import { getVideoWithAttributes } from '@server/helpers/video.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import express from 'express'
import { asyncMiddleware, videoGetValidatorFactory } from '../../../middlewares/index.js'

const storyboardRouter = express.Router()

storyboardRouter.get(
  '/:id/storyboards',
  asyncMiddleware(videoGetValidatorFactory('with-blacklist')),
  asyncMiddleware(listStoryboards)
)

// ---------------------------------------------------------------------------

export {
  storyboardRouter
}

// ---------------------------------------------------------------------------

async function listStoryboards (req: express.Request, res: express.Response) {
  const video = getVideoWithAttributes(res)

  const storyboards = await StoryboardModel.listStoryboardsOf(video)

  return res.json({
    storyboards: storyboards.map(s => s.toFormattedJSON())
  })
}
