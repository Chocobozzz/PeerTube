import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  RegisterRunnerBody,
  RegisterRunnerResult,
  ResultList,
  Runner,
  UnregisterRunnerBody
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class RunnersCommand extends AbstractCommand {
  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
  } = {}) {
    const path = '/api/v1/runners'

    return this.getRequestBody<ResultList<Runner>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  register (options: OverrideCommandOptions & RegisterRunnerBody) {
    const path = '/api/v1/runners/register'

    return unwrapBody<RegisterRunnerResult>(this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'name', 'registrationToken', 'description', 'version' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  unregister (options: OverrideCommandOptions & UnregisterRunnerBody) {
    const path = '/api/v1/runners/unregister'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'runnerToken' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  delete (
    options: OverrideCommandOptions & {
      id: number
    }
  ) {
    const path = '/api/v1/runners/' + options.id

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  async autoRegisterRunner () {
    const { data } = await this.server.runnerRegistrationTokens.list({ sort: 'createdAt' })

    const { runnerToken } = await this.register({
      name: 'runner ' + buildUUID(),
      registrationToken: data[0].registrationToken
    })

    return runnerToken
  }
}
