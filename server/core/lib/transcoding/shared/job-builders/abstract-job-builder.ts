import { ffprobePromise } from '@peertube/peertube-ffmpeg'
import { VideoResolution } from '@peertube/peertube-models'
import { computeOutputFPS } from '@server/helpers/ffmpeg/framerate.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DEFAULT_AUDIO_RESOLUTION, VIDEO_TRANSCODING_FPS } from '@server/initializers/constants.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { canDoQuickTranscode } from '../../transcoding-quick-transcode.js'
import { buildOriginalFileResolution, computeResolutionsToTranscode } from '../../transcoding-resolutions.js'

const lTags = loggerTagsFactory('transcoding')

export abstract class AbstractJobBuilder <P> {

  async createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
    videoFileAlreadyLocked: boolean
  }) {
    const { video, videoFile, isNewVideo, user, videoFileAlreadyLocked } = options

    let mergeOrOptimizePayload: P
    let children: P[][] = []

    const mutexReleaser = videoFileAlreadyLocked
      ? () => {}
      : await VideoPathManager.Instance.lockFiles(video.uuid)

    try {
      await video.reload()
      await videoFile.reload()

      await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), async videoFilePath => {
        const probe = await ffprobePromise(videoFilePath)
        const quickTranscode = await canDoQuickTranscode(videoFilePath, probe)

        let inputFPS: number

        let maxFPS: number
        let maxResolution: number

        let hlsAudioAlreadyGenerated = false

        if (videoFile.isAudio()) {
          inputFPS = maxFPS = VIDEO_TRANSCODING_FPS.AUDIO_MERGE // The first transcoding job will transcode to this FPS value
          maxResolution = DEFAULT_AUDIO_RESOLUTION

          mergeOrOptimizePayload = this.buildMergeAudioPayload({
            video,
            isNewVideo,
            inputFile: videoFile,
            resolution: maxResolution,
            fps: maxFPS
          })
        } else {
          inputFPS = videoFile.fps
          maxResolution = buildOriginalFileResolution(videoFile.resolution)
          maxFPS = computeOutputFPS({ inputFPS, resolution: maxResolution })

          mergeOrOptimizePayload = this.buildOptimizePayload({
            video,
            isNewVideo,
            quickTranscode,
            inputFile: videoFile,
            resolution: maxResolution,
            fps: maxFPS
          })
        }

        // HLS version of max resolution
        if (CONFIG.TRANSCODING.HLS.ENABLED === true) {
          // We had some issues with a web video quick transcoded while producing a HLS version of it
          const copyCodecs = !quickTranscode

          const hlsPayloads: P[] = []

          hlsPayloads.push(
            this.buildHLSJobPayload({
              deleteWebVideoFiles: !CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO && !CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED,
              separatedAudio: CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO,

              copyCodecs,

              resolution: maxResolution,
              fps: maxFPS,
              video,
              isNewVideo
            })
          )

          if (CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO && videoFile.hasAudio()) {
            hlsAudioAlreadyGenerated = true

            hlsPayloads.push(
              this.buildHLSJobPayload({
                deleteWebVideoFiles: !CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED,
                separatedAudio: CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO,

                copyCodecs,
                resolution: 0,
                fps: 0,
                video,
                isNewVideo
              })
            )
          }

          children.push(hlsPayloads)
        }

        const lowerResolutionJobPayloads = await this.buildLowerResolutionJobPayloads({
          video,
          inputVideoResolution: maxResolution,
          inputVideoFPS: inputFPS,
          hasAudio: videoFile.hasAudio(),
          isNewVideo,
          hlsAudioAlreadyGenerated
        })

        children = children.concat(lowerResolutionJobPayloads)
      })
    } finally {
      mutexReleaser()
    }

    await this.createJobs({
      parent: mergeOrOptimizePayload,
      children,
      user,
      video
    })
  }

  async createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }) {
    const { video, transcodingType, resolutions, isNewVideo } = options
    const separatedAudio = CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO

    const maxResolution = Math.max(...resolutions)
    const childrenResolutions = resolutions.filter(r => r !== maxResolution)

    logger.info('Manually creating transcoding jobs for %s.', transcodingType, { childrenResolutions, maxResolution, ...lTags(video.uuid) })

    const inputFPS = video.getMaxFPS()

    const children = childrenResolutions.map(resolution => {
      const fps = computeOutputFPS({ inputFPS, resolution })

      if (transcodingType === 'hls') {
        return this.buildHLSJobPayload({ video, resolution, fps, isNewVideo, separatedAudio })
      }

      if (transcodingType === 'webtorrent' || transcodingType === 'web-video') {
        return this.buildWebVideoJobPayload({ video, resolution, fps, isNewVideo })
      }

      throw new Error('Unknown transcoding type')
    })

    const fps = computeOutputFPS({ inputFPS, resolution: maxResolution })

    const parent = transcodingType === 'hls'
      ? this.buildHLSJobPayload({ video, resolution: maxResolution, fps, isNewVideo, separatedAudio })
      : this.buildWebVideoJobPayload({ video, resolution: maxResolution, fps, isNewVideo })

    // Process the last resolution after the other ones to prevent concurrency issue
    // Because low resolutions use the biggest one as ffmpeg input
    await this.createJobs({ video, parent, children: [ children ], user: null })
  }

  private async buildLowerResolutionJobPayloads (options: {
    video: MVideoFullLight
    inputVideoResolution: number
    inputVideoFPS: number
    hasAudio: boolean
    isNewVideo: boolean
    hlsAudioAlreadyGenerated: boolean
  }) {
    const { video, inputVideoResolution, inputVideoFPS, isNewVideo, hlsAudioAlreadyGenerated, hasAudio } = options

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = await Hooks.wrapObject(
      computeResolutionsToTranscode({ input: inputVideoResolution, type: 'vod', includeInput: false, strictLower: true, hasAudio }),
      'filter:transcoding.auto.resolutions-to-transcode.result',
      options
    )

    logger.debug('Lower resolutions built for %s.', video.uuid, { resolutionsEnabled, ...lTags(video.uuid) })

    const sequentialPayloads: P[][] = []

    for (const resolution of resolutionsEnabled) {
      const fps = computeOutputFPS({ inputFPS: inputVideoFPS, resolution })

      let generateHLS = CONFIG.TRANSCODING.HLS.ENABLED
      if (resolution === VideoResolution.H_NOVIDEO && hlsAudioAlreadyGenerated) generateHLS = false

      const parallelPayloads: P[] = []

      if (CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED) {
        parallelPayloads.push(
          this.buildWebVideoJobPayload({
            video,
            resolution,
            fps,
            isNewVideo
          })
        )
      }

      // Create a subsequent job to create HLS resolution that will just copy web video codecs
      if (generateHLS) {
        parallelPayloads.push(
          this.buildHLSJobPayload({
            video,
            resolution,
            fps,
            isNewVideo,
            separatedAudio: CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO,
            copyCodecs: CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED
          })
        )
      }

      sequentialPayloads.push(parallelPayloads)
    }

    return sequentialPayloads
  }

  // ---------------------------------------------------------------------------

  protected abstract createJobs (options: {
    video: MVideoFullLight
    parent: P
    children: P[][]
    user: MUserId | null
  }): Promise<void>

  protected abstract buildMergeAudioPayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    isNewVideo: boolean
    resolution: number
    fps: number
  }): P

  protected abstract buildOptimizePayload (options: {
    video: MVideoFullLight
    isNewVideo: boolean
    quickTranscode: boolean
    inputFile: MVideoFile
    resolution: number
    fps: number
  }): P

  protected abstract buildHLSJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean
    deleteWebVideoFiles?: boolean // default false
    copyCodecs?: boolean // default false
  }): P

  protected abstract buildWebVideoJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
  }): P

}
