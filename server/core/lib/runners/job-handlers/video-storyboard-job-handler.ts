import {
  GenerateStoryboardSuccess,
  RunnerJobGenerateStoryboardPayload,
  RunnerJobGenerateStoryboardPrivatePayload,
  RunnerJobUpdatePayload,
  VideoFileStream
} from '@peertube/peertube-models'
import { ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { buildUUID } from '@peertube/peertube-node-utils'
import { logger } from '@server/helpers/logger.js'
import { STORYBOARD } from '@server/initializers/constants.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { join } from 'path'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls.js'
import { CONFIG } from '@server/initializers/config.js'
import { move } from 'fs-extra/esm'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { getImageSizeFromWorker } from '@server/lib/worker/parent-process.js'

type CreateOptions = {
  videoUUID: string
  priority: number
  federateAfter?: boolean // currently unused, server handles federation
}

export class VideoStoryboardJobHandler extends AbstractJobHandler<CreateOptions, RunnerJobUpdatePayload, GenerateStoryboardSuccess> {
  async create (options: CreateOptions) {
    const { videoUUID, priority, federateAfter } = options

    const jobUUID = buildUUID()

    const video = await VideoModel.loadFull(videoUUID)
    // Compute sprites metadata on server side for consistency
    const inputFile = video.getMaxQualityFile(VideoFileStream.VIDEO)
    let spriteHeight: number
    let spriteWidth: number
    let duration = 0

    await VideoPathManager.Instance.makeAvailableVideoFile(inputFile, async videoPath => {
      const probe = await ffprobePromise(videoPath)
      const videoStreamInfo = await getVideoStreamDimensionsInfo(videoPath, probe)

      duration = video.duration

      if (videoStreamInfo.isPortraitMode) {
        spriteHeight = STORYBOARD.SPRITE_MAX_SIZE
        spriteWidth = Math.round(spriteHeight * videoStreamInfo.ratio)
      } else {
        spriteWidth = STORYBOARD.SPRITE_MAX_SIZE
        spriteHeight = Math.round(spriteWidth / videoStreamInfo.ratio)
      }
    })

    const { spriteDuration, totalSprites } = buildSpritesMetadata({ duration })
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

    const privatePayload: RunnerJobGenerateStoryboardPrivatePayload = {
      videoUUID,
      federate: !!federateAfter
    }

    const job = await this.createRunnerJob({
      type: 'generate-video-storyboard',
      jobUUID,
      payload,
      privatePayload,
      priority
    })

    return job
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

    const imageSize = await getImageSizeFromWorker(destinationPath)

    const sprites = (runnerJob.payload as RunnerJobGenerateStoryboardPayload).sprites

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async t => {
        const existing = await StoryboardModel.loadByVideo(video.id, t)
        if (existing) await existing.destroy({ transaction: t })

        await StoryboardModel.create({
          filename: destinationFilename,
          totalHeight: imageSize.height,
          totalWidth: imageSize.width,
          spriteHeight: sprites.size.height,
          spriteWidth: sprites.size.width,
          spriteDuration: sprites.duration,
          videoId: video.id
        }, { transaction: t })

        if ((runnerJob.privatePayload as RunnerJobGenerateStoryboardPrivatePayload).federate) {
          await federateVideoIfNeeded(video, false, t)
        }
      })
    })

    logger.info('Runner storyboard job %s for %s ended.', runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid))
  }

  protected specificError (_options: { runnerJob: MRunnerJob }) {}
  protected specificCancel (_options: { runnerJob: MRunnerJob }) {}
}

function buildSpritesMetadata (options: { duration: number }) {
  const { duration } = options
  if (duration < 3) return { spriteDuration: undefined, totalSprites: 0 }

  const maxSprites = Math.min(Math.ceil(duration), STORYBOARD.SPRITES_MAX_EDGE_COUNT * STORYBOARD.SPRITES_MAX_EDGE_COUNT)

  const spriteDuration = Math.ceil(duration / maxSprites)
  const totalSprites = Math.ceil(duration / spriteDuration)

  if (totalSprites <= STORYBOARD.SPRITES_MAX_EDGE_COUNT) return { spriteDuration, totalSprites }

  return { spriteDuration, totalSprites }
}

function findGridSize (options: { toFind: number, maxEdgeCount: number }) {
  const { toFind, maxEdgeCount } = options
  for (let i = 1; i <= maxEdgeCount; i++) {
    for (let j = i; j <= maxEdgeCount; j++) {
      if (toFind <= i * j) return { width: j, height: i }
    }
  }
  throw new Error(`Could not find grid size (to find: ${toFind}, max edge count: ${maxEdgeCount}`)
}


