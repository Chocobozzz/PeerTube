import express from 'express'
import { getVideoWithAttributes } from '@server/helpers/video.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { asyncMiddleware, videosGetValidator } from '../../../middlewares/index.js'

const storyboardRouter = express.Router()

storyboardRouter.get('/:id/storyboards',
  asyncMiddleware(videosGetValidator),
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
