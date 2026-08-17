import { FileStorage, VideoFileStream } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { AbstractTranscriber, transcriberFactory, TranscriptionModel, WhisperBuiltinModel } from '@peertube/peertube-transcription'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils.js'
import { isVideoCaptionLanguageValid, isVTTFileValid } from '@server/helpers/custom-validators/video-captions.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylist, MVideo, MVideoCaption, MVideoFull, MVideoId, MVideoUrl, MVideoUUID } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { ensureDir, remove } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { scheduleVideoFederation } from './activitypub/videos/federate.js'
import { buildCaptionM3U8Content, updateM3U8AndShaPlaylist } from './hls.js'
import { JobQueue } from './job-queue/job-queue.js'
import { Notifier } from './notifier/notifier.js'
import { TranscriptionJobHandler } from './runners/index.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger('caption')

export async function createLocalCaption (options: {
  video: MVideo
  path: string
  language: string
  automaticallyGenerated: boolean
}) {
  const { language, path, video, automaticallyGenerated } = options

  const videoCaption = new VideoCaptionModel({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(language),
    storage: FileStorage.FILE_SYSTEM,
    language,
    automaticallyGenerated,
    cached: false
  }) as MVideoCaption

  await moveAndProcessCaptionFile({ path }, videoCaption)

  const captionDest = videoCaption.getFSFilePath()

  if (!await isVTTFileValid(captionDest)) {
    remove(captionDest)
      .catch(err => logger.error('Cannot remove invalid VTT file', { err }))

    throw new Error(`Invalid VTT file`)
  }

  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)

  // If object storage is enabled, the move to object storage job will upload the playlist on the fly
  videoCaption.m3u8Filename = hls && !CONFIG.OBJECT_STORAGE.ENABLED
    ? await upsertCaptionPlaylistOnFS(videoCaption, video)
    : null

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(t => {
      return VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
    })
  })

  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    await JobQueue.Instance.createJob({ type: 'move-to-object-storage', payload: { captionId: videoCaption.id } })
  }

  logger.info(`Created/replaced caption ${videoCaption.filename} of ${language} of video ${video.uuid}`)

  return Object.assign(videoCaption, { Video: video })
}

// ---------------------------------------------------------------------------

export async function createAllCaptionPlaylistsOnFSIfNeeded (video: MVideo) {
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)

  for (const caption of captions) {
    if (caption.m3u8Filename) continue
    // If object storage is enabled, the move to object storage job will upload the playlist on the fly
    if (CONFIG.OBJECT_STORAGE.ENABLED) continue

    try {
      caption.m3u8Filename = await upsertCaptionPlaylistOnFS(caption, video)
      await caption.save()
    } catch (err) {
      logger.error(`Cannot create caption playlist ${caption.filename} (${caption.language}) of video ${video.uuid}`, { err })
    }
  }
}

export async function updateHLSMasterOnCaptionChangeIfNeeded (video: MVideo) {
  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)
  if (!hls) return

  return updateHLSMasterOnCaptionChange(video, hls)
}

export async function updateHLSMasterOnCaptionChange (video: MVideo, hls: MStreamingPlaylist) {
  logger.debug(`Updating HLS master playlist of video ${video.uuid} after caption change`)

  await updateM3U8AndShaPlaylist(video, hls)
}

// ---------------------------------------------------------------------------

export async function regenerateTranscriptionTaskIfNeeded (video: MVideo) {
  if (video.language && CONFIG.VIDEO_TRANSCRIPTION.ENABLED) {
    const caption = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, video.language)

    if (caption?.automaticallyGenerated) {
      await createTranscriptionTaskIfNeeded(video)
    }
  }
}

export async function createTranscriptionTaskIfNeeded (video: MVideoId & MVideoUUID & MVideoUrl) {
  if (CONFIG.VIDEO_TRANSCRIPTION.ENABLED !== true) return

  if (!await VideoModel.loadHasStream(video.id, VideoFileStream.AUDIO)) {
    logger.info(`Do not create transcription job for ${video.url} that doesn't have an audio stream`)
    return
  }

  logger.info(`Creating transcription job for ${video.url}`)

  if (CONFIG.VIDEO_TRANSCRIPTION.REMOTE_RUNNERS.ENABLED === true) {
    await new TranscriptionJobHandler().create({ video })
  } else {
    await JobQueue.Instance.createJob({ type: 'video-transcription', payload: { videoUUID: video.uuid } })
  }

  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscription')
}

// ---------------------------------------------------------------------------
// Transcription task
// ---------------------------------------------------------------------------

let transcriber: AbstractTranscriber

export async function generateSubtitle (options: {
  video: MVideoUUID
  signal?: AbortSignal
}) {
  const outputPath = join(CONFIG.STORAGE.TMP_DIR, 'transcription', buildSUUID())

  let inputFileMutexReleaser: MutexInterface.Releaser

  try {
    await ensureDir(outputPath)

    const binDirectory = join(DIRECTORIES.LOCAL_PIP_DIRECTORY, 'bin')

    // Lazy load the transcriber
    if (!transcriber) {
      transcriber = transcriberFactory.createFromEngineName({
        engineName: CONFIG.VIDEO_TRANSCRIPTION.ENGINE,
        enginePath: CONFIG.VIDEO_TRANSCRIPTION.ENGINE_PATH,
        logger,
        binDirectory
      })

      if (!CONFIG.VIDEO_TRANSCRIPTION.ENGINE_PATH) {
        logger.info(`Installing transcriber ${transcriber.engine.name} to generate subtitles`)
        await transcriber.install(DIRECTORIES.LOCAL_PIP_DIRECTORY)
      }
    }

    inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(options.video.uuid)

    const video = await VideoModel.loadFull(options.video.uuid)
    if (!video) {
      logger.info('Do not process transcription, video does not exist anymore.')
      return undefined
    }

    const file = video.getMaxQualityFile(VideoFileStream.AUDIO)

    if (!file) {
      logger.info(`Do not run transcription for ${video.uuid} in ${outputPath} because it does not contain an audio stream`, { video })

      return
    }

    await VideoPathManager.Instance.makeAvailableVideoFile(file, async inputPath => {
      // Release input file mutex now we are going to run the command
      setTimeout(() => inputFileMutexReleaser(), 1000)

      logger.info(`Running transcription for ${video.uuid} in ${outputPath}`)

      const transcriptFile = await transcriber.transcribe({
        mediaFilePath: inputPath,

        model: CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH
          ? await TranscriptionModel.fromPath(CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH)
          : new WhisperBuiltinModel(CONFIG.VIDEO_TRANSCRIPTION.MODEL),

        transcriptDirectory: outputPath,

        format: 'vtt',

        signal: options.signal
      })

      const refreshedVideo = await VideoModel.loadFull(video.uuid)
      if (!refreshedVideo) {
        logger.info(`Do not process transcription for video ${video.uuid}: it does not exist anymore.`)
        return
      }

      await onTranscriptionEnded({ video: refreshedVideo, language: transcriptFile.language, vttPath: transcriptFile.path })
    })
  } finally {
    if (outputPath) await remove(outputPath)
    if (inputFileMutexReleaser) inputFileMutexReleaser()

    VideoJobInfoModel.decrease(options.video.uuid, 'pendingTranscription')
      .catch(err => logger.error('Cannot decrease pendingTranscription job count', { err }))
  }
}

export async function onTranscriptionEnded (options: {
  video: MVideoFull
  language: string
  vttPath: string
}) {
  const { video, language, vttPath } = options

  if (!isVideoCaptionLanguageValid(language)) {
    logger.warn(`Invalid transcription language for video ${video.uuid}`)
    return
  }

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    if (!video.language) {
      video.language = language
      await video.save()
    }

    const existing = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language)

    if (existing && !existing.automaticallyGenerated) {
      logger.info(
        `Do not replace existing caption for video ${video.uuid} after transcription (subtitle may have been added while during the transcription process)`
      )
      return
    }

    const caption = await createLocalCaption({
      video,
      language,
      path: vttPath,
      automaticallyGenerated: true
    })

    if (caption.m3u8Filename) {
      await updateHLSMasterOnCaptionChangeIfNeeded(video)
    }

    Notifier.Instance.notifyOfGeneratedVideoTranscription(caption)
  } finally {
    videoFileMutexReleaser()
  }

  scheduleVideoFederation({ video })

  logger.info(`Transcription ended for ${video.uuid}`)
}

export async function upsertCaptionPlaylistOnFS (caption: MVideoCaption, video: MVideo) {
  const m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)
  const m3u8Destination = VideoPathManager.Instance.getFSHLSOutputPath(video, m3u8Filename)

  logger.debug(`Creating caption playlist ${m3u8Destination} of video ${video.uuid}`)

  const content = buildCaptionM3U8Content({ video, caption })
  await ensureDir(dirname(m3u8Destination))
  await writeFile(m3u8Destination, content, 'utf8')

  return m3u8Filename
}
