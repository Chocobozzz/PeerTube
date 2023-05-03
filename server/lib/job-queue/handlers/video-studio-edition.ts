import { Job } from 'bullmq'
import { move, remove } from 'fs-extra'
import { join } from 'path'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg'
import { createTorrentAndSetInfoHashFromPath } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { VIDEO_FILTERS } from '@server/initializers/constants'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { createOptimizeOrMergeAudioJobs } from '@server/lib/transcoding/create-transcoding-job'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles'
import { isAbleToUploadVideo } from '@server/lib/user'
import { buildFileMetadata, removeHLSPlaylist, removeWebTorrentFile } from '@server/lib/video-file'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { approximateIntroOutroAdditionalSize, safeCleanupStudioTMPFiles } from '@server/lib/video-studio'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideo, MVideoFile, MVideoFullLight, MVideoId, MVideoWithAllFiles } from '@server/types/models'
import { getLowercaseExtension, pick } from '@shared/core-utils'
import { buildUUID, getFileSize } from '@shared/extra-utils'
import { FFmpegEdition, ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamDuration, getVideoStreamFPS } from '@shared/ffmpeg'
import {
  VideoStudioEditionPayload,
  VideoStudioTask,
  VideoStudioTaskCutPayload,
  VideoStudioTaskIntroPayload,
  VideoStudioTaskOutroPayload,
  VideoStudioTaskPayload,
  VideoStudioTaskWatermarkPayload
} from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'

const lTagsBase = loggerTagsFactory('video-edition')

async function processVideoStudioEdition (job: Job) {
  const payload = job.data as VideoStudioEditionPayload
  const lTags = lTagsBase(payload.videoUUID)

  logger.info('Process video studio edition of %s in job %s.', payload.videoUUID, job.id, lTags)

  try {
    const video = await VideoModel.loadFull(payload.videoUUID)

    // No video, maybe deleted?
    if (!video) {
      logger.info('Can\'t process job %d, video does not exist.', job.id, lTags)

      await safeCleanupStudioTMPFiles(payload)
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

    const newFile = await buildNewFile(video, editionResultPath)

    const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, newFile)
    await move(editionResultPath, outputPath)

    await safeCleanupStudioTMPFiles(payload)

    await createTorrentAndSetInfoHashFromPath(video, newFile, outputPath)
    await removeAllFiles(video, newFile)

    await newFile.save()

    video.duration = await getVideoStreamDuration(outputPath)
    await video.save()

    await federateVideoIfNeeded(video, false, undefined)

    const user = await UserModel.loadByVideoId(video.id)

    await createOptimizeOrMergeAudioJobs({ video, videoFile: newFile, isNewVideo: false, user, videoFileAlreadyLocked: false })
  } catch (err) {
    await safeCleanupStudioTMPFiles(payload)

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
      watermarkSizeRatio: VIDEO_FILTERS.WATERMARK.SIZE_RATIO,
      horitonzalMarginRatio: VIDEO_FILTERS.WATERMARK.HORIZONTAL_MARGIN_RATIO,
      verticalMarginRatio: VIDEO_FILTERS.WATERMARK.VERTICAL_MARGIN_RATIO
    }
  })
}

// ---------------------------------------------------------------------------

async function buildNewFile (video: MVideoId, path: string) {
  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(path),
    size: await getFileSize(path),
    metadata: await buildFileMetadata(path),
    videoStreamingPlaylistId: null,
    videoId: video.id
  })

  const probe = await ffprobePromise(path)

  videoFile.fps = await getVideoStreamFPS(path, probe)
  videoFile.resolution = (await getVideoStreamDimensionsInfo(path, probe)).resolution

  videoFile.filename = generateWebTorrentVideoFilename(videoFile.resolution, videoFile.extname)

  return videoFile
}

async function removeAllFiles (video: MVideoWithAllFiles, webTorrentFileException: MVideoFile) {
  await removeHLSPlaylist(video)

  for (const file of video.VideoFiles) {
    if (file.id === webTorrentFileException.id) continue

    await removeWebTorrentFile(video, file.id)
  }
}

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
