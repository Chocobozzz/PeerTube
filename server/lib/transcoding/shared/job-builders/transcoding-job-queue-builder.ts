import Bluebird from 'bluebird'
import { computeOutputFPS } from '@server/helpers/ffmpeg'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { DEFAULT_AUDIO_RESOLUTION, VIDEO_TRANSCODING_FPS } from '@server/initializers/constants'
import { CreateJobArgument, JobQueue } from '@server/lib/job-queue'
import { Hooks } from '@server/lib/plugins/hooks'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MUserId, MVideoFile, MVideoFullLight, MVideoWithFileThumbnail } from '@server/types/models'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS, hasAudioStream, isAudioFile } from '@shared/ffmpeg'
import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebVideoResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '@shared/models'
import { getTranscodingJobPriority } from '../../transcoding-priority'
import { canDoQuickTranscode } from '../../transcoding-quick-transcode'
import { buildOriginalFileResolution, computeResolutionsToTranscode } from '../../transcoding-resolutions'
import { AbstractJobBuilder } from './abstract-job-builder'

export class TranscodingJobQueueBuilder extends AbstractJobBuilder {

  async createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
    videoFileAlreadyLocked: boolean
  }) {
    const { video, videoFile, isNewVideo, user, videoFileAlreadyLocked } = options

    let mergeOrOptimizePayload: MergeAudioTranscodingPayload | OptimizeTranscodingPayload
    let nextTranscodingSequentialJobPayloads: (NewWebVideoResolutionTranscodingPayload | HLSTranscodingPayload)[][] = []

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
        const quickTranscode = await canDoQuickTranscode(videoFilePath, probe)
        const inputFPS = videoFile.isAudio()
          ? VIDEO_TRANSCODING_FPS.AUDIO_MERGE // The first transcoding job will transcode to this FPS value
          : await getVideoStreamFPS(videoFilePath, probe)

        const maxResolution = await isAudioFile(videoFilePath, probe)
          ? DEFAULT_AUDIO_RESOLUTION
          : buildOriginalFileResolution(resolution)

        if (CONFIG.TRANSCODING.HLS.ENABLED === true) {
          nextTranscodingSequentialJobPayloads.push([
            this.buildHLSJobPayload({
              deleteWebVideoFiles: CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED === false,

              // We had some issues with a web video quick transcoded while producing a HLS version of it
              copyCodecs: !quickTranscode,

              resolution: maxResolution,
              fps: computeOutputFPS({ inputFPS, resolution: maxResolution }),
              videoUUID: video.uuid,
              isNewVideo
            })
          ])
        }

        const lowerResolutionJobPayloads = await this.buildLowerResolutionJobPayloads({
          video,
          inputVideoResolution: maxResolution,
          inputVideoFPS: inputFPS,
          hasAudio,
          isNewVideo
        })

        nextTranscodingSequentialJobPayloads = [ ...nextTranscodingSequentialJobPayloads, ...lowerResolutionJobPayloads ]

        const hasChildren = nextTranscodingSequentialJobPayloads.length !== 0
        mergeOrOptimizePayload = videoFile.isAudio()
          ? this.buildMergeAudioPayload({ videoUUID: video.uuid, isNewVideo, hasChildren })
          : this.buildOptimizePayload({ videoUUID: video.uuid, isNewVideo, quickTranscode, hasChildren })
      })
    } finally {
      mutexReleaser()
    }

    const nextTranscodingSequentialJobs = await Bluebird.mapSeries(nextTranscodingSequentialJobPayloads, payloads => {
      return Bluebird.mapSeries(payloads, payload => {
        return this.buildTranscodingJob({ payload, user })
      })
    })

    const transcodingJobBuilderJob: CreateJobArgument = {
      type: 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        sequentialJobs: nextTranscodingSequentialJobs
      }
    }

    const mergeOrOptimizeJob = await this.buildTranscodingJob({ payload: mergeOrOptimizePayload, user })

    await JobQueue.Instance.createSequentialJobFlow(...[ mergeOrOptimizeJob, transcodingJobBuilderJob ])

    await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')
  }

  // ---------------------------------------------------------------------------

  async createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }) {
    const { video, transcodingType, resolutions, isNewVideo } = options

    const maxResolution = Math.max(...resolutions)
    const childrenResolutions = resolutions.filter(r => r !== maxResolution)

    logger.info('Manually creating transcoding jobs for %s.', transcodingType, { childrenResolutions, maxResolution })

    const { fps: inputFPS } = await video.probeMaxQualityFile()

    const children = childrenResolutions.map(resolution => {
      const fps = computeOutputFPS({ inputFPS, resolution })

      if (transcodingType === 'hls') {
        return this.buildHLSJobPayload({ videoUUID: video.uuid, resolution, fps, isNewVideo })
      }

      if (transcodingType === 'webtorrent' || transcodingType === 'web-video') {
        return this.buildWebVideoJobPayload({ videoUUID: video.uuid, resolution, fps, isNewVideo })
      }

      throw new Error('Unknown transcoding type')
    })

    const fps = computeOutputFPS({ inputFPS, resolution: maxResolution })

    const parent = transcodingType === 'hls'
      ? this.buildHLSJobPayload({ videoUUID: video.uuid, resolution: maxResolution, fps, isNewVideo })
      : this.buildWebVideoJobPayload({ videoUUID: video.uuid, resolution: maxResolution, fps, isNewVideo })

    // Process the last resolution after the other ones to prevent concurrency issue
    // Because low resolutions use the biggest one as ffmpeg input
    await this.createTranscodingJobsWithChildren({ videoUUID: video.uuid, parent, children, user: null })
  }

  // ---------------------------------------------------------------------------

  private async createTranscodingJobsWithChildren (options: {
    videoUUID: string
    parent: (HLSTranscodingPayload | NewWebVideoResolutionTranscodingPayload)
    children: (HLSTranscodingPayload | NewWebVideoResolutionTranscodingPayload)[]
    user: MUserId | null
  }) {
    const { videoUUID, parent, children, user } = options

    const parentJob = await this.buildTranscodingJob({ payload: parent, user })
    const childrenJobs = await Bluebird.mapSeries(children, c => this.buildTranscodingJob({ payload: c, user }))

    await JobQueue.Instance.createJobWithChildren(parentJob, childrenJobs)

    await VideoJobInfoModel.increaseOrCreate(videoUUID, 'pendingTranscode', 1 + children.length)
  }

  private async buildTranscodingJob (options: {
    payload: VideoTranscodingPayload
    user: MUserId | null // null means we don't want priority
  }) {
    const { user, payload } = options

    return {
      type: 'video-transcoding' as 'video-transcoding',
      priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: undefined }),
      payload
    }
  }

  private async buildLowerResolutionJobPayloads (options: {
    video: MVideoWithFileThumbnail
    inputVideoResolution: number
    inputVideoFPS: number
    hasAudio: boolean
    isNewVideo: boolean
  }) {
    const { video, inputVideoResolution, inputVideoFPS, isNewVideo, hasAudio } = options

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = await Hooks.wrapObject(
      computeResolutionsToTranscode({ input: inputVideoResolution, type: 'vod', includeInput: false, strictLower: true, hasAudio }),
      'filter:transcoding.auto.resolutions-to-transcode.result',
      options
    )

    const sequentialPayloads: (NewWebVideoResolutionTranscodingPayload | HLSTranscodingPayload)[][] = []

    for (const resolution of resolutionsEnabled) {
      const fps = computeOutputFPS({ inputFPS: inputVideoFPS, resolution })

      if (CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED) {
        const payloads: (NewWebVideoResolutionTranscodingPayload | HLSTranscodingPayload)[] = [
          this.buildWebVideoJobPayload({
            videoUUID: video.uuid,
            resolution,
            fps,
            isNewVideo
          })
        ]

        // Create a subsequent job to create HLS resolution that will just copy web video codecs
        if (CONFIG.TRANSCODING.HLS.ENABLED) {
          payloads.push(
            this.buildHLSJobPayload({
              videoUUID: video.uuid,
              resolution,
              fps,
              isNewVideo,
              copyCodecs: true
            })
          )
        }

        sequentialPayloads.push(payloads)
      } else if (CONFIG.TRANSCODING.HLS.ENABLED) {
        sequentialPayloads.push([
          this.buildHLSJobPayload({
            videoUUID: video.uuid,
            resolution,
            fps,
            copyCodecs: false,
            isNewVideo
          })
        ])
      }
    }

    return sequentialPayloads
  }

  private buildHLSJobPayload (options: {
    videoUUID: string
    resolution: number
    fps: number
    isNewVideo: boolean
    deleteWebVideoFiles?: boolean // default false
    copyCodecs?: boolean // default false
  }): HLSTranscodingPayload {
    const { videoUUID, resolution, fps, isNewVideo, deleteWebVideoFiles = false, copyCodecs = false } = options

    return {
      type: 'new-resolution-to-hls',
      videoUUID,
      resolution,
      fps,
      copyCodecs,
      isNewVideo,
      deleteWebVideoFiles
    }
  }

  private buildWebVideoJobPayload (options: {
    videoUUID: string
    resolution: number
    fps: number
    isNewVideo: boolean
  }): NewWebVideoResolutionTranscodingPayload {
    const { videoUUID, resolution, fps, isNewVideo } = options

    return {
      type: 'new-resolution-to-web-video',
      videoUUID,
      isNewVideo,
      resolution,
      fps
    }
  }

  private buildMergeAudioPayload (options: {
    videoUUID: string
    isNewVideo: boolean
    hasChildren: boolean
  }): MergeAudioTranscodingPayload {
    const { videoUUID, isNewVideo, hasChildren } = options

    return {
      type: 'merge-audio-to-web-video',
      resolution: DEFAULT_AUDIO_RESOLUTION,
      fps: VIDEO_TRANSCODING_FPS.AUDIO_MERGE,
      videoUUID,
      isNewVideo,
      hasChildren
    }
  }

  private buildOptimizePayload (options: {
    videoUUID: string
    quickTranscode: boolean
    isNewVideo: boolean
    hasChildren: boolean
  }): OptimizeTranscodingPayload {
    const { videoUUID, quickTranscode, isNewVideo, hasChildren } = options

    return {
      type: 'optimize-to-web-video',
      videoUUID,
      isNewVideo,
      hasChildren,
      quickTranscode
    }
  }
}
