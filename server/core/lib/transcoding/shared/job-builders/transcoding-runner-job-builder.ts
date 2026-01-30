import { pick } from '@peertube/peertube-core-utils'
import { VideoFileStreamType } from '@peertube/peertube-models'
import {
  VODAudioMergeTranscodingJobHandler,
  VODHLSTranscodingJobHandler,
  VODWebVideoTranscodingJobHandler
} from '@server/lib/runners/job-handlers/index.js'
import { MUserId, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/runner-job.js'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { AbstractJobBuilder, TranscodingPriorityType } from './abstract-job-builder.js'

/**
 * Class to build transcoding job in the local job queue
 */

type BasePayload = {
  Builder: new() => VODHLSTranscodingJobHandler
  options: Omit<Parameters<VODHLSTranscodingJobHandler['create']>[0], 'priority'>
} | {
  Builder: new() => VODAudioMergeTranscodingJobHandler
  options: Omit<Parameters<VODAudioMergeTranscodingJobHandler['create']>[0], 'priority'>
} | {
  Builder: new() => VODWebVideoTranscodingJobHandler
  options: Omit<Parameters<VODWebVideoTranscodingJobHandler['create']>[0], 'priority'>
}

type FullPayload = BasePayload & { transcodingPriority: TranscodingPriorityType }

export class TranscodingRunnerJobBuilder extends AbstractJobBuilder<FullPayload> {
  protected async createJobs (options: {
    video: MVideo
    payloads: {
      parent: FullPayload | null
      children: FullPayload[][]
    }
    user: MUserId | null
  }): Promise<void> {
    const { payloads: { parent, children }, user } = options

    const requiredPriority = await getTranscodingJobPriority({ user, type: 'vod-required' })
    const optionalPriority = await getTranscodingJobPriority({ user, type: 'vod-optional' })

    const parentJob = parent
      ? await this.createJob({
        payload: parent,

        priority: parent.transcodingPriority === 'required'
          ? requiredPriority
          : optionalPriority
      })
      : undefined

    for (const parallelPayloads of children) {
      let lastJob = parentJob

      for (const sequentialPayload of parallelPayloads) {
        lastJob = await this.createJob({
          payload: sequentialPayload,

          priority: sequentialPayload.transcodingPriority === 'required'
            ? requiredPriority
            : optionalPriority,

          dependsOnRunnerJob: lastJob
        })
      }

      lastJob = undefined
    }
  }

  private createJob (options: {
    payload: FullPayload
    priority: number
    dependsOnRunnerJob?: MRunnerJob
  }) {
    const { dependsOnRunnerJob, payload, priority } = options

    const builder = new payload.Builder()

    return builder.create({
      ...(payload.options as any), // FIXME: typings

      dependsOnRunnerJob,
      priority
    })
  }

  // ---------------------------------------------------------------------------

  protected buildHLSJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean

    transcodingPriority: TranscodingPriorityType

    canMoveVideoState: boolean
    inputStreams: VideoFileStreamType[]
    transcodingRequestAt: string

    deleteWebVideoFiles?: boolean // default false
  }): FullPayload {
    const { deleteWebVideoFiles = false } = options

    return {
      Builder: VODHLSTranscodingJobHandler,

      options: {
        ...pick(options, [
          'video',
          'resolution',
          'fps',
          'isNewVideo',
          'separatedAudio',
          'canMoveVideoState',
          'transcodingRequestAt',
          'inputStreams'
        ]),

        deleteWebVideoFiles
      },

      ...pick(options, [ 'transcodingPriority' ])
    }
  }

  protected buildWebVideoJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): FullPayload {
    return {
      Builder: VODWebVideoTranscodingJobHandler,

      options: {
        ...pick(options, [
          'video',
          'resolution',
          'fps',
          'isNewVideo',
          'canMoveVideoState',
          'transcodingPriority',
          'canMoveVideoState'
        ]),

        deleteInputFileId: null
      },

      ...pick(options, [ 'transcodingPriority' ])
    }
  }

  protected buildMergeAudioPayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    isNewVideo: boolean
    fps: number
    resolution: number

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): FullPayload {
    const { inputFile } = options

    return {
      Builder: VODAudioMergeTranscodingJobHandler,

      options: {
        ...pick(options, [
          'video',
          'resolution',
          'fps',
          'isNewVideo',
          'canMoveVideoState'
        ]),

        deleteInputFileId: inputFile.id
      },

      ...pick(options, [ 'transcodingPriority' ])
    }
  }

  protected buildOptimizePayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    isNewVideo: boolean
    fps: number
    resolution: number

    transcodingPriority: TranscodingPriorityType
    canMoveVideoState: boolean
  }): FullPayload {
    const { inputFile } = options

    return {
      Builder: VODWebVideoTranscodingJobHandler,

      options: {
        ...pick(options, [
          'video',
          'resolution',
          'fps',
          'isNewVideo',
          'canMoveVideoState'
        ]),

        deleteInputFileId: inputFile.id
      },

      ...pick(options, [ 'transcodingPriority' ])
    }
  }

  protected reassignCanMoveVideoState (payload: FullPayload, canMoveVideoState: boolean) {
    payload.options.canMoveVideoState = canMoveVideoState
  }
}
