import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, Job, JobState, JobType, ResultList } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class JobsCommand extends AbstractCommand {

  async getLatest (options: OverrideCommandOptions & {
    jobType: JobType
  }) {
    const { data } = await this.list({ ...options, start: 0, count: 1, sort: '-createdAt' })

    if (data.length === 0) return undefined

    return data[0]
  }

  pauseJobQueue (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/jobs/pause'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  resumeJobQueue (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/jobs/resume'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions & {
    state?: JobState
    jobType?: JobType
    start?: number
    count?: number
    sort?: string
  } = {}) {
    const path = this.buildJobsUrl(options.state)

    const query = pick(options, [ 'start', 'count', 'sort', 'jobType' ])

    return this.getRequestBody<ResultList<Job>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listFailed (options: OverrideCommandOptions & {
    jobType?: JobType
  }) {
    const path = this.buildJobsUrl('failed')

    return this.getRequestBody<ResultList<Job>>({
      ...options,

      path,
      query: { start: 0, count: 50 },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  private buildJobsUrl (state?: JobState) {
    let path = '/api/v1/jobs'

    if (state) path += '/' + state

    return path
  }
}
