import {
  VODAudioMergeTranscodingJobHandler,
  VODHLSTranscodingJobHandler,
  VODWebVideoTranscodingJobHandler
} from '@server/lib/runners/job-handlers/index.js'
import { MUserId, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/runner-job.js'
import { getTranscodingJobPriority } from '../../transcoding-priority.js'
import { AbstractJobBuilder } from './abstract-job-builder.js'

/**
 *
 * Class to build transcoding job in the local job queue
 *
 */

type Payload = {
  Builder: new () => VODHLSTranscodingJobHandler
  options: Omit<Parameters<VODHLSTranscodingJobHandler['create']>[0], 'priority'>
} | {
  Builder: new () => VODAudioMergeTranscodingJobHandler
  options: Omit<Parameters<VODAudioMergeTranscodingJobHandler['create']>[0], 'priority'>
} |
{
  Builder: new () => VODWebVideoTranscodingJobHandler
  options: Omit<Parameters<VODWebVideoTranscodingJobHandler['create']>[0], 'priority'>
}

// eslint-disable-next-line max-len
export class TranscodingRunnerJobBuilder extends AbstractJobBuilder <Payload> {

  protected async createJobs (options: {
    video: MVideo
    payloads: [ [ Payload ], ...(Payload[][]) ] // Array of sequential jobs to create that depend on parent job
    user: MUserId | null
  }): Promise<void> {
    const { payloads, user } = options

    const parent = payloads[0][0]
    payloads.shift()

    const parentJob = await this.createJob({ payload: parent, user })

    for (const parallelPayloads of payloads) {
      let lastJob = parentJob

      for (const parallelPayload of parallelPayloads) {
        lastJob = await this.createJob({
          payload: parallelPayload,
          dependsOnRunnerJob: lastJob,
          user
        })
      }

      lastJob = undefined
    }
  }

  private async createJob (options: {
    payload: Payload
    user: MUserId | null
    dependsOnRunnerJob?: MRunnerJob
  }) {
    const { dependsOnRunnerJob, payload, user } = options

    const builder = new payload.Builder()

    return builder.create({
      ...(payload.options as any), // FIXME: typings

      dependsOnRunnerJob,
      priority: await getTranscodingJobPriority({ user, type: 'vod', fallback: 0 })
    })
  }

  // ---------------------------------------------------------------------------

  protected buildHLSJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
    separatedAudio: boolean
    deleteWebVideoFiles?: boolean // default false
    copyCodecs?: boolean // default false
  }): Payload {
    const { video, resolution, fps, isNewVideo, separatedAudio, deleteWebVideoFiles = false } = options

    return {
      Builder: VODHLSTranscodingJobHandler,

      options: {
        video,
        resolution,
        fps,
        isNewVideo,
        separatedAudio,
        deleteWebVideoFiles
      }
    }
  }

  protected buildWebVideoJobPayload (options: {
    video: MVideoFullLight
    resolution: number
    fps: number
    isNewVideo: boolean
  }): Payload {
    const { video, resolution, fps, isNewVideo } = options

    return {
      Builder: VODWebVideoTranscodingJobHandler,

      options: {
        video,
        resolution,
        fps,
        isNewVideo,
        deleteInputFileId: null
      }
    }
  }

  protected buildMergeAudioPayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    isNewVideo: boolean
    fps: number
    resolution: number
  }): Payload {
    const { video, isNewVideo, inputFile, resolution, fps } = options

    return {
      Builder: VODAudioMergeTranscodingJobHandler,
      options: {
        video,
        resolution,
        fps,
        isNewVideo,
        deleteInputFileId: inputFile.id
      }
    }
  }

  protected buildOptimizePayload (options: {
    video: MVideoFullLight
    inputFile: MVideoFile
    quickTranscode: boolean
    isNewVideo: boolean
    fps: number
    resolution: number
  }): Payload {
    const { video, isNewVideo, inputFile, fps, resolution } = options

    return {
      Builder: VODWebVideoTranscodingJobHandler,
      options: {
        video,
        resolution,
        fps,
        isNewVideo,
        deleteInputFileId: inputFile.id
      }
    }
  }
}
