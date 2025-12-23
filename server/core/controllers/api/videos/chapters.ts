import { HttpStatusCode, VideoChannelActivityAction, VideoChapterUpdate } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/federate.js'
import { replaceChapters } from '@server/lib/video-chapters.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import express from 'express'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares/index.js'
import { updateVideoChaptersValidator, videosCustomGetValidator } from '../../../middlewares/validators/index.js'

const videoChaptersRouter = express.Router()

videoChaptersRouter.get(
  '/:id/chapters',
  asyncMiddleware(videosCustomGetValidator('only-video-and-blacklist')),
  asyncMiddleware(listVideoChapters)
)

videoChaptersRouter.put(
  '/:videoId/chapters',
  authenticate,
  asyncMiddleware(updateVideoChaptersValidator),
  asyncRetryTransactionMiddleware(replaceVideoChapters)
)

// ---------------------------------------------------------------------------

export {
  videoChaptersRouter
}

// ---------------------------------------------------------------------------

async function listVideoChapters (req: express.Request, res: express.Response) {
  const chapters = await VideoChapterModel.listChaptersOfVideo(res.locals.onlyVideo.id)

  return res.json({ chapters: chapters.map(c => c.toFormattedJSON()) })
}

async function replaceVideoChapters (req: express.Request, res: express.Response) {
  const body = req.body as VideoChapterUpdate
  const video = res.locals.videoAll

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      await replaceChapters({ video, chapters: body.chapters, transaction: t })

      await VideoChannelActivityModel.addVideoActivity({
        action: VideoChannelActivityAction.UPDATE_CHAPTERS,
        user: res.locals.oauth.token.User,
        channel: video.VideoChannel,
        video,
        transaction: t
      })

      await federateVideoIfNeeded(video, false, t)
    })
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
