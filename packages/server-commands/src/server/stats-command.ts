import { HttpStatusCode, ServerStats } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class StatsCommand extends AbstractCommand {

  get (options: OverrideCommandOptions & {
    useCache?: boolean // default false
  } = {}) {
    const { useCache = false } = options
    const path = '/api/v1/server/stats'

    const query = {
      t: useCache ? undefined : new Date().getTime()
    }

    return this.getRequestBody<ServerStats>({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
