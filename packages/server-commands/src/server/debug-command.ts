import { Debug, HttpStatusCode, SendDebugCommand } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class DebugCommand extends AbstractCommand {

  getDebug (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/server/debug'

    return this.getRequestBody<Debug>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  sendCommand (options: OverrideCommandOptions & {
    body: SendDebugCommand
  }) {
    const { body } = options
    const path = '/api/v1/server/debug/run-command'

    return this.postBodyRequest({
      ...options,

      path,
      fields: body,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
