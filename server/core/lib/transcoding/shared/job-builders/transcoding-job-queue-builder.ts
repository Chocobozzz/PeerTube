import { pick } from '@peertube/peertube-core-utils'
import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebVideoResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoFileStreamType,
  VideoTranscodingPayload
} from '@peertube/peertube-models'
import { CreateJobArgument, JobQueue } from '@server/lib/job-queue/index.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MUserId, MVideo } from '@server/types/models/index.js'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { AbstractJobBuilder, TranscodingPriorityType } from './abstract-job-builder.js'

type BasePayload =
  | MergeAudioTranscodingPayload
  | OptimizeTranscodingPayload
  | NewWebVideoResolutionTranscodingPayload
  | HLSTranscodingPayload

type FullPayload = BasePayload & { transcodingPriority: TranscodingPriorityType }

export class TranscodingJobQueueBuilder extends AbstractJobBuilder<FullPayload> {
  protected async createJobs (options: {
    video: MVideo
    payloads: {
      parent: FullPayload | null
      children: FullPayload[][]
    }
    user: MUserId | null
  }): Promise<void> {
    const { video, payloads: { parent, children }, user } = options

    const requiredPriority = await getTranscodingJobPriority({ user, type: 'vod-required' })
    const optionalPriority = await getTranscodingJobPriority({ user, type: 'vod-optional' })

    const nextTranscodingSequentialJobs = children.map(p => {
      return p.map(payload => {
        return this.buildTranscodingJob({
          payload,

          priority: payload.transcodingPriority === 'required'
            ? requiredPriority
            : optionalPriority
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

    const parentJob = parent
      ? this.buildTranscodingJob({
        payload: parent,

        priority: parent.transcodingPriority === 'required'
          ? requiredPriority
          : optionalPriority
      })
      : undefined

    await JobQueue.Instance.createSequentialJobFlow(parentJob, transcodingJobBuilderJob)

    // transcoding-job-builder job will increase pendingTranscode
    if (parentJob) {
      await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')
    }
  }

  private buildTranscodingJob (options: {
    payload: VideoTranscodingPayload
    priority: number
  }) {
    const { priority, payload } = options

    return {
      type: 'video-transcoding' as 'video-transcoding',
      priority,
      payload
    }
  }

  // ---------------------------------------------------------------------------

  protected buildHLSJobPayload (options: {
    video: MVideo
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean

    transcodingPriority: TranscodingPriorityType

    transcodingRequestAt: string
    canMoveVideoState: boolean
    inputStreams: VideoFileStreamType[]

    deleteWebVideoFiles?: boolean // default false
  }): HLSTranscodingPayload & { transcodingPriority: TranscodingPriorityType } {
    const { video, deleteWebVideoFiles = false } = options

    return {
      type: 'new-resolution-to-hls',
      videoUUID: video.uuid,

      ...pick(options, [
        'resolution',
        'fps',
        'isNewVideo',
        'separatedAudio',
        'canMoveVideoState',
        'transcodingPriority',
        'transcodingRequestAt',
        'inputStreams'
      ]),

      deleteWebVideoFiles
    }
  }

  protected buildWebVideoJobPayload (options: {
    video: MVideo
    resolution: number
    fps: number
    isNewVideo: boolean

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): NewWebVideoResolutionTranscodingPayload & { transcodingPriority: TranscodingPriorityType } {
    const { video } = options

    return {
      type: 'new-resolution-to-web-video',
      videoUUID: video.uuid,

      ...pick(options, [
        'isNewVideo',
        'resolution',
        'fps',
        'transcodingPriority',
        'canMoveVideoState'
      ])
    }
  }

  protected buildMergeAudioPayload (options: {
    video: MVideo
    isNewVideo: boolean
    fps: number
    resolution: number

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): MergeAudioTranscodingPayload & { transcodingPriority: TranscodingPriorityType } {
    const { video } = options

    return {
      type: 'merge-audio-to-web-video',
      videoUUID: video.uuid,

      ...pick(options, [
        'resolution',
        'fps',
        'isNewVideo',
        'transcodingPriority',
        'canMoveVideoState'
      ])
    }
  }

  protected buildOptimizePayload (options: {
    video: MVideo
    isNewVideo: boolean

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): OptimizeTranscodingPayload & { transcodingPriority: TranscodingPriorityType } {
    const { video } = options

    return {
      type: 'optimize-to-web-video',

      videoUUID: video.uuid,

      ...pick(options, [
        'isNewVideo',
        'transcodingPriority',
        'canMoveVideoState'
      ])
    }
  }

  // ---------------------------------------------------------------------------

  protected reassignCanMoveVideoState (payload: FullPayload, canMoveVideoState: boolean): void {
    payload.canMoveVideoState = canMoveVideoState
  }
}
