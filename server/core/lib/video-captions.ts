import { FileStorage, VideoFileStream } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { AbstractTranscriber, TranscriptionModel, WhisperBuiltinModel, transcriberFactory } from '@peertube/peertube-transcription'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils.js'
import { isVideoCaptionLanguageValid } from '@server/helpers/custom-validators/video-captions.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylist, MVideo, MVideoCaption, MVideoFullLight, MVideoId, MVideoUUID, MVideoUrl } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { ensureDir, remove } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { federateVideoIfNeeded } from './activitypub/videos/federate.js'
import { buildCaptionM3U8Content, updateM3U8AndShaPlaylist } from './hls.js'
import { JobQueue } from './job-queue/job-queue.js'
import { Notifier } from './notifier/notifier.js'
import { TranscriptionJobHandler } from './runners/index.js'
import { VideoPathManager } from './video-path-manager.js'

const lTags = loggerTagsFactory('video-caption')

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
    automaticallyGenerated
  }) as MVideoCaption

  await moveAndProcessCaptionFile({ path }, videoCaption)

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

  logger.info(`Created/replaced caption ${videoCaption.filename} of ${language} of video ${video.uuid}`, lTags(video.uuid))

  return Object.assign(videoCaption, { Video: video })
}

// ---------------------------------------------------------------------------

export async function createAllCaptionPlaylistsOnFSIfNeeded (video: MVideo) {
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)

  for (const caption of captions) {
    if (caption.m3u8Filename) continue

    try {
      caption.m3u8Filename = await upsertCaptionPlaylistOnFS(caption, video)
      await caption.save()
    } catch (err) {
      logger.error(
        `Cannot create caption playlist ${caption.filename} (${caption.language}) of video ${video.uuid}`,
        { ...lTags(video.uuid), err }
      )
    }
  }
}

export async function updateHLSMasterOnCaptionChangeIfNeeded (video: MVideo) {
  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)
  if (!hls) return

  return updateHLSMasterOnCaptionChange(video, hls)
}

export async function updateHLSMasterOnCaptionChange (video: MVideo, hls: MStreamingPlaylist) {
  logger.debug(`Updating HLS master playlist of video ${video.uuid} after caption change`, lTags(video.uuid))

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
    logger.info(`Do not create transcription job for ${video.url} that doesn't have an audio stream`, lTags(video.uuid))
    return
  }

  logger.info(`Creating transcription job for ${video.url}`, lTags(video.uuid))

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
        logger.info(`Installing transcriber ${transcriber.engine.name} to generate subtitles`, lTags())
        await transcriber.install(DIRECTORIES.LOCAL_PIP_DIRECTORY)
      }
    }

    inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(options.video.uuid)

    const video = await VideoModel.loadFull(options.video.uuid)
    if (!video) {
      logger.info('Do not process transcription, video does not exist anymore.', lTags(options.video.uuid))
      return undefined
    }

    const file = video.getMaxQualityFile(VideoFileStream.AUDIO)

    if (!file) {
      logger.info(
        `Do not run transcription for ${video.uuid} in ${outputPath} because it does not contain an audio stream`,
        { video, ...lTags(video.uuid) }
      )

      return
    }

    await VideoPathManager.Instance.makeAvailableVideoFile(file, async inputPath => {
      // Release input file mutex now we are going to run the command
      setTimeout(() => inputFileMutexReleaser(), 1000)

      logger.info(`Running transcription for ${video.uuid} in ${outputPath}`, lTags(video.uuid))

      const transcriptFile = await transcriber.transcribe({
        mediaFilePath: inputPath,

        model: CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH
          ? await TranscriptionModel.fromPath(CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH)
          : new WhisperBuiltinModel(CONFIG.VIDEO_TRANSCRIPTION.MODEL),

        transcriptDirectory: outputPath,

        format: 'vtt'
      })

      const refreshedVideo = await VideoModel.loadFull(video.uuid)
      if (!refreshedVideo) {
        logger.info(`Do not process transcription for video ${video.uuid}: it does not exist anymore.`, lTags(video.uuid))
        return
      }

      await onTranscriptionEnded({ video: refreshedVideo, language: transcriptFile.language, vttPath: transcriptFile.path })
    })
  } finally {
    if (outputPath) await remove(outputPath)
    if (inputFileMutexReleaser) inputFileMutexReleaser()

    VideoJobInfoModel.decrease(options.video.uuid, 'pendingTranscription')
      .catch(err => logger.error('Cannot decrease pendingTranscription job count', { err, ...lTags(options.video.uuid) }))
  }
}

export async function onTranscriptionEnded (options: {
  video: MVideoFullLight
  language: string
  vttPath: string
  lTags?: (string | number)[]
}) {
  const { video, language, vttPath, lTags: customLTags = [] } = options

  if (!isVideoCaptionLanguageValid(language)) {
    logger.warn(`Invalid transcription language for video ${video.uuid}`, lTags(video.uuid))
    return
  }

  if (!video.language) {
    video.language = language
    await video.save()
  }

  const existing = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language)
  if (existing && !existing.automaticallyGenerated) {
    logger.info(
      // eslint-disable-next-line max-len
      `Do not replace existing caption for video ${video.uuid} after transcription (subtitle may have been added while during the transcription process)`,
      lTags(video.uuid)
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

  await sequelizeTypescript.transaction(async t => {
    await federateVideoIfNeeded(video, false, t)
  })

  Notifier.Instance.notifyOfGeneratedVideoTranscription(caption)

  logger.info(`Transcription ended for ${video.uuid}`, lTags(video.uuid, ...customLTags))
}

export async function upsertCaptionPlaylistOnFS (caption: MVideoCaption, video: MVideo) {
  const m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)
  const m3u8Destination = VideoPathManager.Instance.getFSHLSOutputPath(video, m3u8Filename)

  logger.debug(`Creating caption playlist ${m3u8Destination} of video ${video.uuid}`, lTags(video.uuid))

  const content = buildCaptionM3U8Content({ video, caption })
  await writeFile(m3u8Destination, content, 'utf8')

  return m3u8Filename
}
