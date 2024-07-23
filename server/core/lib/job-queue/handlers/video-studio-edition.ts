import { pick } from '@peertube/peertube-core-utils'
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
import { buildUUID } from '@peertube/peertube-node-utils'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { approximateIntroOutroAdditionalSize, onVideoStudioEnded, safeCleanupStudioTMPFiles } from '@server/lib/video-studio.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFullLight } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'

const lTagsBase = loggerTagsFactory('video-studio')

async function processVideoStudioEdition (job: Job) {
  const payload = job.data as VideoStudioEditionPayload
  const lTags = lTagsBase(payload.videoUUID)

  logger.info('Process video studio edition of %s in job %s.', payload.videoUUID, job.id, lTags)

  let inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(payload.videoUUID)

  try {
    const video = await VideoModel.loadFull(payload.videoUUID)

    // No video, maybe deleted?
    if (!video) {
      logger.info('Can\'t process job %d, video does not exist.', job.id, lTags)

      await safeCleanupStudioTMPFiles(payload.tasks)
      return undefined
    }

    await checkUserQuotaOrThrow(video, payload)

    await video.reload()

    const editionResultPath = await VideoPathManager.Instance.makeAvailableMaxQualityFiles(video, async ({
      videoPath: originalVideoFilePath,
      separatedAudioPath
    }) => {
      let tmpInputFilePath: string
      let outputPath: string

      for (const task of payload.tasks) {
        const outputFilename = buildUUID() + extname(originalVideoFilePath)
        outputPath = join(CONFIG.STORAGE.TMP_DIR, outputFilename)

        await processTask({
          videoInputPath: tmpInputFilePath ?? originalVideoFilePath,

          separatedAudioInputPath: tmpInputFilePath
            ? undefined
            : separatedAudioPath,

          inputFileMutexReleaser,

          video,
          outputPath,
          task,
          lTags
        })

        if (tmpInputFilePath) await remove(tmpInputFilePath)

        // For the next iteration
        tmpInputFilePath = outputPath
        inputFileMutexReleaser = undefined
      }

      return outputPath
    })

    logger.info('Video edition ended for video %s.', video.uuid, lTags)

    await onVideoStudioEnded({ video, editionResultPath, tasks: payload.tasks })
  } catch (err) {
    await safeCleanupStudioTMPFiles(payload.tasks)

    throw err
  } finally {
    if (inputFileMutexReleaser) inputFileMutexReleaser()
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoStudioEdition
}

// ---------------------------------------------------------------------------

type TaskProcessorOptions <T extends VideoStudioTaskPayload = VideoStudioTaskPayload> = {
  videoInputPath: string
  separatedAudioInputPath?: string

  inputFileMutexReleaser: MutexInterface.Releaser

  outputPath: string
  video: MVideo
  task: T
  lTags: { tags: (string | number)[] }
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
    ...pick(options, [ 'inputFileMutexReleaser', 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

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
    ...pick(options, [ 'inputFileMutexReleaser', 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

function processAddWatermark (options: TaskProcessorOptions<VideoStudioTaskWatermarkPayload>) {
  const { task, lTags } = options

  logger.debug('Will add watermark to the video.', { options, ...lTags })

  return buildFFmpegEdition().addWatermark({
    ...pick(options, [ 'inputFileMutexReleaser', 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

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
  if (await isUserQuotaValid({ userId: user.id, uploadSize: additionalBytes }) === false) {
    throw new Error('Quota exceeded for this user to edit the video')
  }
}

function buildFFmpegEdition () {
  return new FFmpegEdition(getFFmpegCommandWrapperOptions('vod', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()))
}
