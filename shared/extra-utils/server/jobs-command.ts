import { pick } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { Job, JobState, JobType, ResultList } from '../../models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class JobsCommand extends AbstractCommand {

  async getLatest (options: OverrideCommandOptions & {
    jobType: JobType
  }) {
    const { data } = await this.list({ ...options, start: 0, count: 1, sort: '-createdAt' })

    if (data.length === 0) return undefined

    return data[0]
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

  private buildJobsUrl (state?: JobState) {
    let path = '/api/v1/jobs'

    if (state) path += '/' + state

    return path
  }
}
