import { computeOutputFPS } from '@server/helpers/ffmpeg/index.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DEFAULT_AUDIO_RESOLUTION, VIDEO_TRANSCODING_FPS } from '@server/initializers/constants.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import {
  VODAudioMergeTranscodingJobHandler,
  VODHLSTranscodingJobHandler,
  VODWebVideoTranscodingJobHandler
} from '@server/lib/runners/index.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { MUserId, MVideoFile, MVideoFullLight, MVideoWithFileThumbnail } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS, hasAudioStream, isAudioFile } from '@peertube/peertube-ffmpeg'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { buildOriginalFileResolution, computeResolutionsToTranscode } from '../../transcoding-resolutions.js'
import { AbstractJobBuilder } from './abstract-job-builder.js'

/**
 *
 * Class to build transcoding job in the local job queue
 *
 */

const lTags = loggerTagsFactory('transcoding')

export class TranscodingRunnerJobBuilder extends AbstractJobBuilder {

  async createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
    videoFileAlreadyLocked: boolean
  }) {
    const { video, videoFile, isNewVideo, user, videoFileAlreadyLocked } = options

    const mutexReleaser = videoFileAlreadyLocked
      ? () => {}
      : await VideoPathManager.Instance.lockFiles(video.uuid)

    try {
      await video.reload()
      await videoFile.reload()

      await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), async videoFilePath => {
        const probe = await ffprobePromise(videoFilePath)

        const { resolution } = await getVideoStreamDimensionsInfo(videoFilePath, probe)
        const hasAudio = await hasAudioStream(videoFilePath, probe)
        const inputFPS = videoFile.isAudio()
          ? VIDEO_TRANSCODING_FPS.AUDIO_MERGE // The first transcoding job will transcode to this FPS value
          : await getVideoStreamFPS(videoFilePath, probe)

        const isAudioInput = await isAudioFile(videoFilePath, probe)
        const maxResolution = isAudioInput
          ? DEFAULT_AUDIO_RESOLUTION
          : buildOriginalFileResolution(resolution)

        const fps = computeOutputFPS({ inputFPS, resolution: maxResolution })
        const priority = await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })

        const deleteInputFileId = isAudioInput || maxResolution !== resolution
          ? videoFile.id
          : null

        const jobPayload = { video, resolution: maxResolution, fps, isNewVideo, priority, deleteInputFileId }

        const mainRunnerJob = videoFile.isAudio()
          ? await new VODAudioMergeTranscodingJobHandler().create(jobPayload)
          : await new VODWebVideoTranscodingJobHandler().create(jobPayload)

        if (CONFIG.TRANSCODING.HLS.ENABLED === true) {
          await new VODHLSTranscodingJobHandler().create({
            video,
            deleteWebVideoFiles: CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED === false,
            resolution: maxResolution,
            fps,
            isNewVideo,
            dependsOnRunnerJob: mainRunnerJob,
            priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
          })
        }

        await this.buildLowerResolutionJobPayloads({
          video,
          inputVideoResolution: maxResolution,
          inputVideoFPS: inputFPS,
          hasAudio,
          isNewVideo,
          mainRunnerJob,
          user
        })
      })
    } finally {
      mutexReleaser()
    }
  }

  // ---------------------------------------------------------------------------

  async createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }) {
    const { video, transcodingType, resolutions, isNewVideo, user } = options

    const maxResolution = Math.max(...resolutions)
    const { fps: inputFPS } = await video.probeMaxQualityFile()
    const maxFPS = computeOutputFPS({ inputFPS, resolution: maxResolution })
    const priority = await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })

    const childrenResolutions = resolutions.filter(r => r !== maxResolution)

    logger.info('Manually creating transcoding jobs for %s.', transcodingType, { childrenResolutions, maxResolution })

    const jobPayload = { video, resolution: maxResolution, fps: maxFPS, isNewVideo, priority, deleteInputFileId: null }

    // Process the last resolution before the other ones to prevent concurrency issue
    // Because low resolutions use the biggest one as ffmpeg input
    const mainJob = transcodingType === 'hls'
      // eslint-disable-next-line max-len
      ? await new VODHLSTranscodingJobHandler().create({ ...jobPayload, deleteWebVideoFiles: false })
      : await new VODWebVideoTranscodingJobHandler().create(jobPayload)

    for (const resolution of childrenResolutions) {
      const dependsOnRunnerJob = mainJob
      const fps = computeOutputFPS({ inputFPS, resolution })

      if (transcodingType === 'hls') {
        await new VODHLSTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          deleteWebVideoFiles: false,
          dependsOnRunnerJob,
          priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
        })
        continue
      }

      if (transcodingType === 'webtorrent' || transcodingType === 'web-video') {
        await new VODWebVideoTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          dependsOnRunnerJob,
          deleteInputFileId: null,
          priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
        })
        continue
      }

      throw new Error('Unknown transcoding type')
    }
  }

  private async buildLowerResolutionJobPayloads (options: {
    mainRunnerJob: MRunnerJob
    video: MVideoWithFileThumbnail
    inputVideoResolution: number
    inputVideoFPS: number
    hasAudio: boolean
    isNewVideo: boolean
    user: MUserId
  }) {
    const { video, inputVideoResolution, inputVideoFPS, isNewVideo, hasAudio, mainRunnerJob, user } = options

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = await Hooks.wrapObject(
      computeResolutionsToTranscode({ input: inputVideoResolution, type: 'vod', includeInput: false, strictLower: true, hasAudio }),
      'filter:transcoding.auto.resolutions-to-transcode.result',
      options
    )

    logger.debug('Lower resolutions build for %s.', video.uuid, { resolutionsEnabled, ...lTags(video.uuid) })

    for (const resolution of resolutionsEnabled) {
      const fps = computeOutputFPS({ inputFPS: inputVideoFPS, resolution })

      if (CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED) {
        await new VODWebVideoTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          dependsOnRunnerJob: mainRunnerJob,
          deleteInputFileId: null,
          priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
        })
      }

      if (CONFIG.TRANSCODING.HLS.ENABLED) {
        await new VODHLSTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          deleteWebVideoFiles: false,
          dependsOnRunnerJob: mainRunnerJob,
          priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
        })
      }
    }
  }
}
