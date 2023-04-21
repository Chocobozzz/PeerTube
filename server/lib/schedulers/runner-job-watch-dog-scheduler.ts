import { CONFIG } from '@server/initializers/config'
import { RunnerJobModel } from '@server/models/runner/runner-job'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { getRunnerJobHandlerClass } from '../runners'
import { AbstractScheduler } from './abstract-scheduler'

const lTags = loggerTagsFactory('runner')

export class RunnerJobWatchDogScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.RUNNER_JOB_WATCH_DOG

  private constructor () {
    super()
  }

  protected async internalExecute () {
    const vodStalledJobs = await RunnerJobModel.listStalledJobs({
      staleTimeMS: CONFIG.REMOTE_RUNNERS.STALLED_JOBS.VOD,
      types: [ 'vod-audio-merge-transcoding', 'vod-hls-transcoding', 'vod-web-video-transcoding' ]
    })

    const liveStalledJobs = await RunnerJobModel.listStalledJobs({
      staleTimeMS: CONFIG.REMOTE_RUNNERS.STALLED_JOBS.LIVE,
      types: [ 'live-rtmp-hls-transcoding' ]
    })

    for (const stalled of [ ...vodStalledJobs, ...liveStalledJobs ]) {
      logger.info('Abort stalled runner job %s (%s)', stalled.uuid, stalled.type, lTags(stalled.uuid, stalled.type))

      const Handler = getRunnerJobHandlerClass(stalled)
      await new Handler().abort({ runnerJob: stalled })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
