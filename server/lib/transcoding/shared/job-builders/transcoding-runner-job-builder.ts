import { computeOutputFPS } from '@server/helpers/ffmpeg'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { DEFAULT_AUDIO_RESOLUTION, VIDEO_TRANSCODING_FPS } from '@server/initializers/constants'
import { Hooks } from '@server/lib/plugins/hooks'
import { VODAudioMergeTranscodingJobHandler, VODHLSTranscodingJobHandler, VODWebVideoTranscodingJobHandler } from '@server/lib/runners'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { MUserId, MVideoFile, MVideoFullLight, MVideoWithFileThumbnail } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS, hasAudioStream, isAudioFile } from '@shared/ffmpeg'
import { getTranscodingJobPriority } from '../../transcoding-priority'
import { computeResolutionsToTranscode } from '../../transcoding-resolutions'
import { AbstractJobBuilder } from './abstract-job-builder'

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

        const maxResolution = await isAudioFile(videoFilePath, probe)
          ? DEFAULT_AUDIO_RESOLUTION
          : resolution

        const fps = computeOutputFPS({ inputFPS, resolution: maxResolution })
        const priority = await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })

        const mainRunnerJob = videoFile.isAudio()
          ? await new VODAudioMergeTranscodingJobHandler().create({ video, resolution: maxResolution, fps, isNewVideo, priority })
          : await new VODWebVideoTranscodingJobHandler().create({ video, resolution: maxResolution, fps, isNewVideo, priority })

        if (CONFIG.TRANSCODING.HLS.ENABLED === true) {
          await new VODHLSTranscodingJobHandler().create({
            video,
            deleteWebVideoFiles: CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false,
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
    transcodingType: 'hls' | 'webtorrent'
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

    // Process the last resolution before the other ones to prevent concurrency issue
    // Because low resolutions use the biggest one as ffmpeg input
    const mainJob = transcodingType === 'hls'
      // eslint-disable-next-line max-len
      ? await new VODHLSTranscodingJobHandler().create({ video, resolution: maxResolution, fps: maxFPS, isNewVideo, deleteWebVideoFiles: false, priority })
      : await new VODWebVideoTranscodingJobHandler().create({ video, resolution: maxResolution, fps: maxFPS, isNewVideo, priority })

    for (const resolution of childrenResolutions) {
      const dependsOnRunnerJob = mainJob
      const fps = computeOutputFPS({ inputFPS, resolution: maxResolution })

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

      if (transcodingType === 'webtorrent') {
        await new VODWebVideoTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          dependsOnRunnerJob,
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

      if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED) {
        await new VODWebVideoTranscodingJobHandler().create({
          video,
          resolution,
          fps,
          isNewVideo,
          dependsOnRunnerJob: mainRunnerJob,
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
