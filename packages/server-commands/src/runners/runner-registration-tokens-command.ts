import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ResultList, RunnerRegistrationToken } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class RunnerRegistrationTokensCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
  } = {}) {
    const path = '/api/v1/runners/registration-tokens'

    return this.getRequestBody<ResultList<RunnerRegistrationToken>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  generate (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/runners/registration-tokens/generate'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  delete (options: OverrideCommandOptions & {
    id: number
  }) {
    const path = '/api/v1/runners/registration-tokens/' + options.id

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async getFirstRegistrationToken (options: OverrideCommandOptions = {}) {
    const { data } = await this.list(options)

    return data[0].registrationToken
  }
}
