import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebVideoResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '@peertube/peertube-models'
import { CreateJobArgument, JobQueue } from '@server/lib/job-queue/index.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MUserId, MVideo } from '@server/types/models/index.js'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { AbstractJobBuilder } from './abstract-job-builder.js'

type Payload =
  MergeAudioTranscodingPayload |
  OptimizeTranscodingPayload |
  NewWebVideoResolutionTranscodingPayload |
  HLSTranscodingPayload

type PayloadWithPriority = Payload & { higherPriority?: boolean }

export class TranscodingJobQueueBuilder extends AbstractJobBuilder <Payload> {

  protected async createJobs (options: {
    video: MVideo
    // Array of sequential jobs to create that depend on parent job
    payloads: [ [ PayloadWithPriority ], ...(PayloadWithPriority[][]) ]
    user: MUserId | null
  }): Promise<void> {
    const { video, payloads, user } = options

    const priority = await getTranscodingJobPriority({ user, type: 'vod', fallback: undefined })

    const parent = payloads[0][0]
    payloads.shift()

    const nextTranscodingSequentialJobs = payloads.map(p => {
      return p.map(payload => {
        return this.buildTranscodingJob({
          payload,
          priority: payload.higherPriority ? priority - 1 : priority
        })
      })
    })

    const transcodingJobBuilderJob: CreateJobArgument = {
      type: 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        sequentialJobs: nextTranscodingSequentialJobs
      }
    }

    const parentJob = this.buildTranscodingJob({
      payload: parent,
      priority: parent.higherPriority ? priority - 1 : priority,
      hasChildren: payloads.length !== 0
    })

    await JobQueue.Instance.createSequentialJobFlow(parentJob, transcodingJobBuilderJob)

    // transcoding-job-builder job will increase pendingTranscode
    await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')
  }

  private buildTranscodingJob (options: {
    payload: VideoTranscodingPayload
    hasChildren?: boolean
    priority: number
  }) {
    const { priority, payload, hasChildren = false } = options

    return {
      type: 'video-transcoding' as 'video-transcoding',
      priority,
      payload: { ...payload, hasChildren }
    }
  }

  // ---------------------------------------------------------------------------

  protected buildHLSJobPayload (options: {
    video: MVideo
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean
    deleteWebVideoFiles?: boolean // default false
    copyCodecs?: boolean // default false
  }): HLSTranscodingPayload {
    const { video, resolution, fps, isNewVideo, separatedAudio, deleteWebVideoFiles = false, copyCodecs = false } = options

    return {
      type: 'new-resolution-to-hls',
      videoUUID: video.uuid,
      resolution,
      fps,
      copyCodecs,
      isNewVideo,
      separatedAudio,
      deleteWebVideoFiles
    }
  }

  protected buildWebVideoJobPayload (options: {
    video: MVideo
    resolution: number
    fps: number
    isNewVideo: boolean
  }): NewWebVideoResolutionTranscodingPayload {
    const { video, resolution, fps, isNewVideo } = options

    return {
      type: 'new-resolution-to-web-video',
      videoUUID: video.uuid,
      isNewVideo,
      resolution,
      fps
    }
  }

  protected buildMergeAudioPayload (options: {
    video: MVideo
    isNewVideo: boolean
    fps: number
    resolution: number
  }): MergeAudioTranscodingPayload {
    const { video, isNewVideo, resolution, fps } = options

    return {
      type: 'merge-audio-to-web-video',
      resolution,
      fps,
      videoUUID: video.uuid,

      // Will be set later
      hasChildren: undefined,

      isNewVideo
    }
  }

  protected buildOptimizePayload (options: {
    video: MVideo
    quickTranscode: boolean
    isNewVideo: boolean
  }): OptimizeTranscodingPayload {
    const { video, quickTranscode, isNewVideo } = options

    return {
      type: 'optimize-to-web-video',

      videoUUID: video.uuid,
      isNewVideo,

      // Will be set later
      hasChildren: undefined,

      quickTranscode
    }
  }

}
