import { Job } from 'bull'
import { move, remove } from 'fs-extra'
import { join } from 'path'
import { addIntroOutro, addWatermark, cutVideo } from '@server/helpers/ffmpeg'
import { createTorrentAndSetInfoHashFromPath } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles'
import { isAbleToUploadVideo } from '@server/lib/user'
import { addMoveToObjectStorageJob, addOptimizeOrMergeAudioJob } from '@server/lib/video'
import { approximateIntroOutroAdditionalSize } from '@server/lib/video-editor'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { buildNextVideoState } from '@server/lib/video-state'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideo, MVideoFile, MVideoFullLight, MVideoId, MVideoWithAllFiles } from '@server/types/models'
import { getLowercaseExtension, pick } from '@shared/core-utils'
import {
  buildFileMetadata,
  buildUUID,
  ffprobePromise,
  getFileSize,
  getVideoStreamDimensionsInfo,
  getVideoStreamDuration,
  getVideoStreamFPS
} from '@shared/extra-utils'
import {
  VideoEditionPayload,
  VideoEditionTaskPayload,
  VideoEditorTask,
  VideoEditorTaskCutPayload,
  VideoEditorTaskIntroPayload,
  VideoEditorTaskOutroPayload,
  VideoEditorTaskWatermarkPayload,
  VideoState
} from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'

const lTagsBase = loggerTagsFactory('video-edition')

async function processVideoEdition (job: Job) {
  const payload = job.data as VideoEditionPayload

  logger.info('Process video edition of %s in job %d.', payload.videoUUID, job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)

  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id, lTagsBase(payload.videoUUID))
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
        task
      })

      if (tmpInputFilePath) await remove(tmpInputFilePath)

      // For the next iteration
      tmpInputFilePath = outputPath
    }

    return outputPath
  })

  logger.info('Video edition ended for video %s.', video.uuid)

  const newFile = await buildNewFile(video, editionResultPath)

  const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, newFile)
  await move(editionResultPath, outputPath)

  await createTorrentAndSetInfoHashFromPath(video, newFile, outputPath)

  await removeAllFiles(video, newFile)

  await newFile.save()

  video.state = buildNextVideoState()
  video.duration = await getVideoStreamDuration(outputPath)
  await video.save()

  await federateVideoIfNeeded(video, false, undefined)

  if (video.state === VideoState.TO_TRANSCODE) {
    const user = await UserModel.loadByVideoId(video.id)

    await addOptimizeOrMergeAudioJob(video, newFile, user, false)
  } else if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    await addMoveToObjectStorageJob(video, false)
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoEdition
}

// ---------------------------------------------------------------------------

type TaskProcessorOptions <T extends VideoEditionTaskPayload = VideoEditionTaskPayload> = {
  inputPath: string
  outputPath: string
  video: MVideo
  task: T
}

const taskProcessors: { [id in VideoEditorTask['name']]: (options: TaskProcessorOptions) => Promise<any> } = {
  'add-intro': processAddIntroOutro,
  'add-outro': processAddIntroOutro,
  'cut': processCut,
  'add-watermark': processAddWatermark
}

async function processTask (options: TaskProcessorOptions) {
  const { video, task } = options

  logger.info('Processing %s task for video %s.', task.name, video.uuid, { task })

  const processor = taskProcessors[options.task.name]
  if (!process) throw new Error('Unknown task ' + task.name)

  return processor(options)
}

function processAddIntroOutro (options: TaskProcessorOptions<VideoEditorTaskIntroPayload | VideoEditorTaskOutroPayload>) {
  const { task } = options

  return addIntroOutro({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    introOutroPath: task.options.file,
    type: task.name === 'add-intro'
      ? 'intro'
      : 'outro',

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE
  })
}

function processCut (options: TaskProcessorOptions<VideoEditorTaskCutPayload>) {
  const { task } = options

  return cutVideo({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

function processAddWatermark (options: TaskProcessorOptions<VideoEditorTaskWatermarkPayload>) {
  const { task } = options

  return addWatermark({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    watermarkPath: task.options.file,

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE
  })
}

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
  const hls = video.getHLSPlaylist()

  if (hls) {
    await video.removeStreamingPlaylistFiles(hls)
    await hls.destroy()
  }

  for (const file of video.VideoFiles) {
    if (file.id === webTorrentFileException.id) continue

    await video.removeWebTorrentFileAndTorrent(file)
    await file.destroy()
  }
}

async function checkUserQuotaOrThrow (video: MVideoFullLight, payload: VideoEditionPayload) {
  const user = await UserModel.loadByVideoId(video.id)

  const filePathFinder = (i: number) => (payload.tasks[i] as VideoEditorTaskIntroPayload | VideoEditorTaskOutroPayload).options.file

  const additionalBytes = await approximateIntroOutroAdditionalSize(video, payload.tasks, filePathFinder)
  if (await isAbleToUploadVideo(user.id, additionalBytes) === false) {
    throw new Error('Quota exceeded for this user to edit the video')
  }
}
