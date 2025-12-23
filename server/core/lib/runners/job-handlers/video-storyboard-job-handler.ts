import {
  GenerateStoryboardSuccess,
  RunnerJobGenerateStoryboardPayload,
  RunnerJobGenerateStoryboardPrivatePayload,
  RunnerJobUpdatePayload,
  VideoFileStream
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { JOB_PRIORITY, STORYBOARD } from '@server/initializers/constants.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { getImageSizeFromWorker } from '@server/lib/worker/parent-process.js'
import { VideoModel } from '@server/models/video/video.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { move } from 'fs-extra/esm'
import { join } from 'path'
import { buildSpriteSize, buildTotalSprites, findGridSize, insertStoryboardInDatabase } from '../../storyboard.js'
import { generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls.js'
import { AbstractJobHandler } from './abstract-job-handler.js'

const lTagsBase = loggerTagsFactory('storyboard', 'runners')

type CreateOptions = {
  videoUUID: string
}

export class VideoStoryboardJobHandler extends AbstractJobHandler<CreateOptions, RunnerJobUpdatePayload, GenerateStoryboardSuccess> {
  async create (options: CreateOptions) {
    const { videoUUID } = options
    const lTags = lTagsBase(videoUUID)

    const jobUUID = buildUUID()

    const video = await VideoModel.loadFull(videoUUID)
    const inputFile = video.getMaxQualityFile(VideoFileStream.VIDEO)

    return VideoPathManager.Instance.makeAvailableVideoFile(inputFile, async videoPath => {
      const { spriteHeight, spriteWidth } = await buildSpriteSize(videoPath)

      const { spriteDuration, totalSprites } = buildTotalSprites(video)
      if (totalSprites === 0) {
        logger.info(`Do not generate remote storyboard job of ${videoUUID} because the video is not long enough`, lTags)
        return
      }

      const spritesCount = findGridSize({ toFind: totalSprites, maxEdgeCount: STORYBOARD.SPRITES_MAX_EDGE_COUNT })

      const payload: RunnerJobGenerateStoryboardPayload = {
        input: {
          videoFileUrl: generateRunnerTranscodingVideoInputFileUrl(jobUUID, videoUUID)
        },
        sprites: {
          size: { height: spriteHeight, width: spriteWidth },
          count: spritesCount,
          duration: spriteDuration
        },
        output: {}
      }

      const privatePayload: RunnerJobGenerateStoryboardPrivatePayload = { videoUUID }

      const job = await this.createRunnerJob({
        type: 'generate-video-storyboard',
        jobUUID,
        payload,
        privatePayload,
        priority: JOB_PRIORITY.STORYBOARD
      })

      return job
    })
  }

  protected isAbortSupported () {
    return true
  }

  protected specificUpdate (_options: { runnerJob: MRunnerJob }) {}
  protected specificAbort (_options: { runnerJob: MRunnerJob }) {}

  // When runner returns the storyboard image, finish the server-side creation like local job would
  protected async specificComplete (options: { runnerJob: MRunnerJob, resultPayload: GenerateStoryboardSuccess }) {
    const { runnerJob, resultPayload } = options

    const video = await VideoModel.loadFull(runnerJob.privatePayload.videoUUID)
    if (!video) return

    const destinationFilename = generateImageFilename()
    const destinationPath = join(CONFIG.STORAGE.STORYBOARDS_DIR, destinationFilename)

    await move(resultPayload.storyboardFile as string, destinationPath)

    const { sprites } = runnerJob.payload as RunnerJobGenerateStoryboardPayload

    await insertStoryboardInDatabase({
      videoUUID: video.uuid,
      lTags: this.lTags(video.uuid, runnerJob.uuid),

      filename: destinationFilename,
      destination: destinationPath,

      imageSize: await getImageSizeFromWorker(destinationPath),

      spriteHeight: sprites.size.height,
      spriteWidth: sprites.size.width,
      spriteDuration: sprites.duration,

      federate: true
    })

    logger.info('Runner storyboard job %s for %s ended.', runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid))
  }

  protected specificError (_options: { runnerJob: MRunnerJob }) {}
  protected specificCancel (_options: { runnerJob: MRunnerJob }) {}
}
