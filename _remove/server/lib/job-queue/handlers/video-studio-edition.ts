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
import { addOptimizeOrMergeAudioJob } from '@server/lib/video'
import { removeHLSPlaylist, removeWebTorrentFile } from '@server/lib/video-file'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { approximateIntroOutroAdditionalSize } from '@server/lib/video-studio'
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

  logger.info('Process video studio edition of %s in job %d.', payload.videoUUID, job.id, lTags)

  const video = await VideoModel.loadFull(payload.videoUUID)

  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id, lTags)
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

  await createTorrentAndSetInfoHashFromPath(video, newFile, outputPath)
  await removeAllFiles(video, newFile)

  await newFile.save()

  video.duration = await getVideoStreamDuration(outputPath)
  await video.save()

  await federateVideoIfNeeded(video, false, undefined)

  const user = await UserModel.loadByVideoId(video.id)
  await addOptimizeOrMergeAudioJob({ video, videoFile: newFile, user, isNewVideo: false })
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
  const { video, task } = options

  logger.info('Processing %s task for video %s.', task.name, video.uuid, { task, ...options.lTags })

  const processor = taskProcessors[options.task.name]
  if (!process) throw new Error('Unknown task ' + task.name)

  return processor(options)
}

function processAddIntroOutro (options: TaskProcessorOptions<VideoStudioTaskIntroPayload | VideoStudioTaskOutroPayload>) {
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

function processCut (options: TaskProcessorOptions<VideoStudioTaskCutPayload>) {
  const { task } = options

  return cutVideo({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

function processAddWatermark (options: TaskProcessorOptions<VideoStudioTaskWatermarkPayload>) {
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
