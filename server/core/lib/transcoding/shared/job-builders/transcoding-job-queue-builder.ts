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
import Bluebird from 'bluebird'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { AbstractJobBuilder } from './abstract-job-builder.js'

type Payload =
  MergeAudioTranscodingPayload |
  OptimizeTranscodingPayload |
  NewWebVideoResolutionTranscodingPayload |
  HLSTranscodingPayload

export class TranscodingJobQueueBuilder extends AbstractJobBuilder <Payload> {

  protected async createJobs (options: {
    video: MVideo
    parent: Payload
    children: Payload[][]
    user: MUserId | null
  }): Promise<void> {
    const { video, parent, children, user } = options

    const nextTranscodingSequentialJobs = await Bluebird.mapSeries(children, payloads => {
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

    const mergeOrOptimizeJob = await this.buildTranscodingJob({ payload: parent, user, hasChildren: !!children.length })

    await JobQueue.Instance.createSequentialJobFlow(mergeOrOptimizeJob, transcodingJobBuilderJob)

    // transcoding-job-builder job will increase pendingTranscode
    await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')
  }

  private async buildTranscodingJob (options: {
    payload: VideoTranscodingPayload
    hasChildren?: boolean
    user: MUserId | null // null means we don't want priority
  }) {
    const { user, payload, hasChildren = false } = options

    return {
      type: 'video-transcoding' as 'video-transcoding',
      priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: undefined }),
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
