import { VideoFileStream } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { hasVTTCues } from '@server/helpers/captions-utils.js'
import { isVideoCaptionLanguageValid } from '@server/helpers/custom-validators/video-captions.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFull, MVideoId, MVideoUrl, MVideoUUID } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { ensureDir, remove } from 'fs-extra/esm'
import { join } from 'path'
import { scheduleVideoFederation } from '../activitypub/videos/federate.js'
import { JobQueue } from '../job-queue/job-queue.js'
import { Notifier } from '../notifier/notifier.js'
import { PluginManager } from '../plugins/plugin-manager.js'
import { TranscriptionJobHandler } from '../runners/index.js'
import { createLocalCaption, updateHLSMasterOnCaptionChangeIfNeeded } from '../video-captions.js'
import { VideoPathManager } from '../video-path-manager.js'
import { buildBuiltinTranscriber, loadPluginTranscriber, TranscribeOptions } from './shared/index.js'

const logger = createLogger('transcription')

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
    if (PluginManager.Instance.hasHook('filter:transcription.transcriber.result')) {
      logger.warn(`Transcription of ${video.url} is processed by remote runners, so the transcriber provided by a plugin is not used`)
    }

    await new TranscriptionJobHandler().create({ video })
  } else {
    await JobQueue.Instance.createJob({ type: 'video-transcription', payload: { videoUUID: video.uuid } })
  }

  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscription')
}

// ---------------------------------------------------------------------------

export async function runTranscription (options: {
  video: MVideoUUID
  signal?: AbortSignal
}) {
  const workingDirectory = join(CONFIG.STORAGE.TMP_DIR, 'transcription', buildSUUID())

  let inputFileMutexReleaser: MutexInterface.Releaser

  try {
    await ensureDir(workingDirectory)

    inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(options.video.uuid)

    const video = await VideoModel.loadFull(options.video.uuid)
    if (!video) {
      logger.info('Do not process transcription, video does not exist anymore.')
      return undefined
    }

    const file = video.getMaxQualityFile(VideoFileStream.AUDIO)
    if (!file) {
      logger.info(`Do not run transcription for ${video.uuid} because it does not contain an audio stream`)
      return undefined
    }

    await VideoPathManager.Instance.makeAvailableVideoFile(file, async inputPath => {
      // Release input file mutex now we are going to run the transcribers (plugin hooks, builtin transcriber installation, etc.)
      setTimeout(() => inputFileMutexReleaser(), 1000)

      logger.info(`Running transcription for ${video.uuid} in ${workingDirectory}`)

      const transcriptFile = await transcribe(video, {
        mediaFilePath: inputPath,
        language: video.language,
        workingDirectory,
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
    await remove(workingDirectory)
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

  // The transcriber may not detect any speech (music, etc.)
  if (!await hasVTTCues(vttPath)) {
    logger.info(`Do not create caption for video ${video.uuid}: the transcription is empty`)
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

// ---------------------------------------------------------------------------

async function transcribe (video: MVideoFull, options: TranscribeOptions) {
  // The plugin transcriber, if any, has priority over the builtin one
  const transcribers = [ await loadPluginTranscriber(video), buildBuiltinTranscriber() ].filter(t => !!t)

  for (const transcriber of transcribers) {
    const transcriptFile = await transcriber.transcribe(options)
    if (transcriptFile) return transcriptFile

    logger.info(`Transcriber "${transcriber.name}" did not transcribe ${video.uuid}, fallback to the next transcriber`)
  }

  throw new Error(`No transcriber generated the transcript of ${video.uuid}`)
}
