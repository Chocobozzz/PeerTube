import { HttpStatusCode } from '@shared/core-utils'
import { makePostBodyRequest } from '../requests/requests'
import { ServerInfo } from '../server/servers'

export interface CommonCommandOptions {
  token?: string
  expectedStatus?: number
}

abstract class AbstractCommand {

  private expectedStatus = HttpStatusCode.OK_200

  constructor (
    protected server: ServerInfo
  ) {

  }

  setServer (server: ServerInfo) {
    this.server = server
  }

  setExpectedStatus (status: HttpStatusCode) {
    this.expectedStatus = status
  }

  protected postBodyRequest (options: CommonCommandOptions & {
    path: string
    defaultExpectedStatus: number
    fields?: { [ fieldName: string ]: any }
  }) {
    const { token, fields, expectedStatus, defaultExpectedStatus, path } = options

    return makePostBodyRequest({
      url: this.server.url,
      path,
      token: token ?? this.server.accessToken,
      fields,
      statusCodeExpected: expectedStatus ?? this.expectedStatus ?? defaultExpectedStatus
    })
  }
}

export {
  AbstractCommand
}
