import { Job } from 'bullmq'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles.js'
import { isAbleToUploadVideo } from '@server/lib/user.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { approximateIntroOutroAdditionalSize, onVideoStudioEnded, safeCleanupStudioTMPFiles } from '@server/lib/video-studio.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFullLight } from '@server/types/models/index.js'
import { pick } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import { FFmpegEdition } from '@peertube/peertube-ffmpeg'
import {
  VideoStudioEditionPayload,
  VideoStudioTask,
  VideoStudioTaskCutPayload,
  VideoStudioTaskIntroPayload,
  VideoStudioTaskOutroPayload,
  VideoStudioTaskPayload,
  VideoStudioTaskWatermarkPayload
} from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'

const lTagsBase = loggerTagsFactory('video-studio')

async function processVideoStudioEdition (job: Job) {
  const payload = job.data as VideoStudioEditionPayload
  const lTags = lTagsBase(payload.videoUUID)

  logger.info('Process video studio edition of %s in job %s.', payload.videoUUID, job.id, lTags)

  try {
    const video = await VideoModel.loadFull(payload.videoUUID)

    // No video, maybe deleted?
    if (!video) {
      logger.info('Can\'t process job %d, video does not exist.', job.id, lTags)

      await safeCleanupStudioTMPFiles(payload.tasks)
      return undefined
    }

    await checkUserQuotaOrThrow(video, payload)

    const inputFile = video.getMaxQualityFile()

    const editionResultPath = await VideoPathManager.Instance.makeAvailableVideoFile(inputFile, async originalFilePath => {
      let tmpInputFilePath: string
      let outputPath: string

      for (const task of payload.tasks) {
        const outputFilename = buildUUID() + inputFile.extname
        outputPath = join(CONFIG.STORAGE.TMP_DIR, outputFilename)

        await processTask({
          inputPath: tmpInputFilePath ?? originalFilePath,
          video,
          outputPath,
          task,
          lTags
        })

        if (tmpInputFilePath) await remove(tmpInputFilePath)

        // For the next iteration
        tmpInputFilePath = outputPath
      }

      return outputPath
    })

    logger.info('Video edition ended for video %s.', video.uuid, lTags)

    await onVideoStudioEnded({ video, editionResultPath, tasks: payload.tasks })
  } catch (err) {
    await safeCleanupStudioTMPFiles(payload.tasks)

    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoStudioEdition
}

// ---------------------------------------------------------------------------

type TaskProcessorOptions <T extends VideoStudioTaskPayload = VideoStudioTaskPayload> = {
  inputPath: string
  outputPath: string
  video: MVideo
  task: T
  lTags: { tags: string[] }
}

const taskProcessors: { [id in VideoStudioTask['name']]: (options: TaskProcessorOptions) => Promise<any> } = {
  'add-intro': processAddIntroOutro,
  'add-outro': processAddIntroOutro,
  'cut': processCut,
  'add-watermark': processAddWatermark
}

async function processTask (options: TaskProcessorOptions) {
  const { video, task, lTags } = options

  logger.info('Processing %s task for video %s.', task.name, video.uuid, { task, ...lTags })

  const processor = taskProcessors[options.task.name]
  if (!process) throw new Error('Unknown task ' + task.name)

  return processor(options)
}

function processAddIntroOutro (options: TaskProcessorOptions<VideoStudioTaskIntroPayload | VideoStudioTaskOutroPayload>) {
  const { task, lTags } = options

  logger.debug('Will add intro/outro to the video.', { options, ...lTags })

  return buildFFmpegEdition().addIntroOutro({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    introOutroPath: task.options.file,
    type: task.name === 'add-intro'
      ? 'intro'
      : 'outro'
  })
}

function processCut (options: TaskProcessorOptions<VideoStudioTaskCutPayload>) {
  const { task, lTags } = options

  logger.debug('Will cut the video.', { options, ...lTags })

  return buildFFmpegEdition().cutVideo({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

function processAddWatermark (options: TaskProcessorOptions<VideoStudioTaskWatermarkPayload>) {
  const { task, lTags } = options

  logger.debug('Will add watermark to the video.', { options, ...lTags })

  return buildFFmpegEdition().addWatermark({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    watermarkPath: task.options.file,

    videoFilters: {
      watermarkSizeRatio: task.options.watermarkSizeRatio,
      horitonzalMarginRatio: task.options.horitonzalMarginRatio,
      verticalMarginRatio: task.options.verticalMarginRatio
    }
  })
}

// ---------------------------------------------------------------------------

async function checkUserQuotaOrThrow (video: MVideoFullLight, payload: VideoStudioEditionPayload) {
  const user = await UserModel.loadByVideoId(video.id)

  const filePathFinder = (i: number) => (payload.tasks[i] as VideoStudioTaskIntroPayload | VideoStudioTaskOutroPayload).options.file

  const additionalBytes = await approximateIntroOutroAdditionalSize(video, payload.tasks, filePathFinder)
  if (await isAbleToUploadVideo(user.id, additionalBytes) === false) {
    throw new Error('Quota exceeded for this user to edit the video')
  }
}

function buildFFmpegEdition () {
  return new FFmpegEdition(getFFmpegCommandWrapperOptions('vod', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()))
}
