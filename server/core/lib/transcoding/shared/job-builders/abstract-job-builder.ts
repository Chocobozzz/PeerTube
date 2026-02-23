import { VideoFileStreamType, VideoResolution } from '@peertube/peertube-models'
import { computeOutputFPS } from '@server/helpers/ffmpeg/framerate.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DEFAULT_AUDIO_MERGE_RESOLUTION, DEFAULT_AUDIO_RESOLUTION } from '@server/initializers/constants.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { buildOriginalFileResolution, computeResolutionsToTranscode } from '../../transcoding-resolutions.js'

const lTags = loggerTagsFactory('transcoding')

export type TranscodingPriorityType = 'required' | 'optional'

export abstract class AbstractJobBuilder<P extends { transcodingPriority: TranscodingPriorityType }> {
  async createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
  }) {
    const { video, videoFile, isNewVideo, user } = options

    let mergeOrOptimizePayload: P
    let children: P[][] = []

    const inputStreams = video.getStreamTypes()
    const transcodingRequestAt = new Date().toISOString()

    let maxFPS: number
    let maxResolution: number

    let hlsAudioAlreadyGenerated = false

    if (videoFile.isAudio()) {
      // The first transcoding job will transcode to this FPS value
      maxFPS = Math.min(DEFAULT_AUDIO_MERGE_RESOLUTION, CONFIG.TRANSCODING.FPS.MAX)
      maxResolution = DEFAULT_AUDIO_RESOLUTION

      mergeOrOptimizePayload = this.buildMergeAudioPayload({
        video,
        isNewVideo,
        inputFile: videoFile,
        resolution: maxResolution,
        fps: maxFPS,

        transcodingPriority: 'required',
        canMoveVideoState: null // Will be set below
      })
    } else {
      const inputFPS = videoFile.fps
      maxResolution = buildOriginalFileResolution(videoFile.resolution)
      maxFPS = computeOutputFPS({ inputFPS, resolution: maxResolution, isOriginResolution: true, type: 'vod' })

      mergeOrOptimizePayload = this.buildOptimizePayload({
        video,
        isNewVideo,
        inputFile: videoFile,
        resolution: maxResolution,
        fps: maxFPS,

        transcodingPriority: 'required',
        canMoveVideoState: null // Will be set below
      })
    }

    // HLS version of max resolution
    if (CONFIG.TRANSCODING.HLS.ENABLED === true) {
      const hasSplitAudioTranscoding = CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO && videoFile.hasAudio()

      children.push([
        this.buildHLSJobPayload({
          deleteWebVideoFiles: !CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED,

          separatedAudio: hasSplitAudioTranscoding,

          resolution: maxResolution,
          fps: maxFPS,
          video,
          isNewVideo,

          inputStreams,
          transcodingRequestAt,

          transcodingPriority: 'required',
          canMoveVideoState: true
        })
      ])

      if (hasSplitAudioTranscoding) {
        hlsAudioAlreadyGenerated = true

        children.push([
          this.buildHLSJobPayload({
            deleteWebVideoFiles: !CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED,
            separatedAudio: hasSplitAudioTranscoding,

            resolution: 0,
            fps: 0,
            video,
            isNewVideo,

            inputStreams,
            transcodingRequestAt,

            transcodingPriority: 'required',
            canMoveVideoState: true
          })
        ])
      }
    }

    const lowerResolutionJobPayloads = await this.buildLowerResolutionJobPayloads({
      video,
      inputStreams,
      transcodingRequestAt,
      inputVideoResolution: maxResolution,
      inputVideoFPS: maxFPS,
      hasAudio: videoFile.hasAudio(),
      isNewVideo,
      hlsAudioAlreadyGenerated
    })

    children = children.concat(lowerResolutionJobPayloads)

    this.reassignCanMoveVideoState(mergeOrOptimizePayload, children.length === 0)

    await this.createJobs({
      payloads: {
        parent: mergeOrOptimizePayload,
        children
      },
      user,
      video
    })
  }

  async createTranscodingJobs (options: {
    transcodingType: 'hls' | 'web-video'
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }) {
    const { video, transcodingType, resolutions, isNewVideo } = options
    const separatedAudio = CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO
    const transcodingRequestAt = new Date().toISOString()

    const inputStreams = video.getStreamTypes()
    const maxResolution = Math.max(...resolutions)

    logger.info(`Manually creating transcoding jobs for ${transcodingType}`, { resolutions, maxResolution, ...lTags(video.uuid) })

    const inputFPS = video.getMaxFPS()

    const children = resolutions
      .map(resolution => {
        const fps = computeOutputFPS({ inputFPS, resolution, isOriginResolution: maxResolution === resolution, type: 'vod' })

        if (transcodingType === 'hls') {
          // We'll generate audio resolution in a parent job
          if (resolution === VideoResolution.H_NOVIDEO && separatedAudio) return undefined

          return [
            this.buildHLSJobPayload({
              video,
              resolution,
              fps,
              isNewVideo,
              separatedAudio,
              canMoveVideoState: true,
              inputStreams,
              transcodingRequestAt,
              transcodingPriority: 'optional'
            })
          ]
        }

        if (transcodingType === 'web-video') {
          return [
            this.buildWebVideoJobPayload({
              video,
              resolution,
              fps,
              isNewVideo,
              canMoveVideoState: true,
              transcodingPriority: 'optional'
            })
          ]
        }

        throw new Error('Unknown transcoding type')
      })
      .filter(r => !!r)

    const fps = computeOutputFPS({ inputFPS, resolution: maxResolution, isOriginResolution: true, type: 'vod' })

    // Process audio first to not override the max resolution where the audio stream will be removed
    const parent = transcodingType === 'hls' && separatedAudio
      ? this.buildHLSJobPayload({
        video,
        resolution: VideoResolution.H_NOVIDEO,
        fps,
        isNewVideo,
        separatedAudio,
        canMoveVideoState: true,
        transcodingRequestAt,
        inputStreams,
        transcodingPriority: 'optional'
      })
      : undefined

    await this.createJobs({ video, payloads: { parent, children }, user: null })
  }

  private async buildLowerResolutionJobPayloads (options: {
    video: MVideoFullLight
    inputVideoResolution: number
    inputVideoFPS: number
    inputStreams: VideoFileStreamType[]
    hasAudio: boolean
    isNewVideo: boolean
    hlsAudioAlreadyGenerated: boolean
    transcodingRequestAt: string
  }) {
    const {
      video,
      inputVideoResolution,
      inputVideoFPS,
      inputStreams,
      isNewVideo,
      hlsAudioAlreadyGenerated,
      hasAudio,
      transcodingRequestAt
    } = options

    // Create transcoding jobs if there are enabled resolutions
    const computeResolutionsOptions = {
      input: inputVideoResolution,
      type: 'vod' as const,
      includeInput: false,
      strictLower: true,
      hasAudio,
      forceAudioResolution: CONFIG.TRANSCODING.ALWAYS_TRANSCODE_PODCAST_OPTIMIZED_AUDIO
    }

    const resolutionsEnabled = await Hooks.wrapObject(
      computeResolutionsToTranscode(computeResolutionsOptions),
      'filter:transcoding.auto.resolutions-to-transcode.result',
      options
    )

    logger.debug('Lower resolutions built for %s.', video.uuid, { resolutionsEnabled, ...lTags(video.uuid) })

    const sequentialPayloads: P[][] = []

    for (const resolution of resolutionsEnabled) {
      const fps = computeOutputFPS({
        inputFPS: inputVideoFPS,
        resolution,
        isOriginResolution: resolution === inputVideoResolution,
        type: 'vod'
      })

      const parallelPayloads: P[] = []

      if (
        CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED ||
        (resolution === VideoResolution.H_NOVIDEO && CONFIG.TRANSCODING.ALWAYS_TRANSCODE_PODCAST_OPTIMIZED_AUDIO)
      ) {
        parallelPayloads.push(
          this.buildWebVideoJobPayload({
            video,
            resolution,
            fps,
            isNewVideo,
            canMoveVideoState: true,
            transcodingPriority: 'optional'
          })
        )
      }

      // Create a subsequent job to create HLS resolution that will just copy web video codecs
      let generateHLS = CONFIG.TRANSCODING.HLS.ENABLED

      if (resolution === VideoResolution.H_NOVIDEO && (hlsAudioAlreadyGenerated || CONFIG.TRANSCODING.RESOLUTIONS['0p'] !== true)) {
        // Audio already generated
        // Or the global audio resolution is not enabled (can still be in that case if ALWAYS_TRANSCODE_PODCAST_OPTIMIZED_AUDIO is enabled)
        generateHLS = false
      }

      if (generateHLS) {
        parallelPayloads.push(
          this.buildHLSJobPayload({
            video,
            resolution,
            fps,
            isNewVideo,
            separatedAudio: hasAudio && CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO,
            canMoveVideoState: true,
            transcodingPriority: 'optional',
            transcodingRequestAt,
            inputStreams
          })
        )
      }

      if (parallelPayloads.length !== 0) {
        sequentialPayloads.push(parallelPayloads)
      }
    }

    return sequentialPayloads
  }

  // ---------------------------------------------------------------------------

  protected abstract createJobs (options: {
    video: MVideoFullLight
    payloads: {
      parent: P

      // Parallel of sequential jobs to execute
      // [ [ Parallel1 ], [ Parallel2 ], ... ]
      // [ [ Seq1, Seq2, ... ], [ Seq1, ... ]
      children: P[][]
    }
    user: MUserId | null
  }): Promise<void>

  protected abstract buildMergeAudioPayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    isNewVideo: boolean
    resolution: number
    fps: number

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): P

  protected abstract buildOptimizePayload (options: {
    video: MVideoFullLight
    isNewVideo: boolean
    inputFile: MVideoFile
    resolution: number
    fps: number

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): P

  protected abstract buildHLSJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean

    deleteWebVideoFiles?: boolean // default false

    inputStreams: VideoFileStreamType[]
    canMoveVideoState: boolean
    transcodingRequestAt: string

    transcodingPriority: TranscodingPriorityType
  }): P

  protected abstract buildWebVideoJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): P

  // ---------------------------------------------------------------------------

  protected abstract reassignCanMoveVideoState (payload: P, canMoveVideoState: boolean): void
}
