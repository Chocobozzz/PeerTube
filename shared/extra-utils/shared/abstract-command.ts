import { HttpStatusCode } from '@shared/core-utils'
import { makeGetRequest, makePostBodyRequest, makePutBodyRequest, unwrap } from '../requests/requests'
import { ServerInfo } from '../server/servers'

export interface OverrideCommandOptions {
  token?: string
  expectedStatus?: number
}

interface CommonCommandOptions extends OverrideCommandOptions {
  path: string
  defaultExpectedStatus: number
}

abstract class AbstractCommand {

  private expectedStatus: HttpStatusCode

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

  protected getRequestBody <T> (options: CommonCommandOptions) {
    return unwrap<T>(makeGetRequest(this.buildCommonRequestOptions(options)))
  }

  protected putBodyRequest (options: CommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
  }) {
    const { fields } = options

    return makePutBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields
    })
  }

  protected postBodyRequest (options: CommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
  }) {
    const { fields } = options

    return makePostBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields
    })
  }

  private buildCommonRequestOptions (options: CommonCommandOptions) {
    const { token, expectedStatus, defaultExpectedStatus, path } = options

    return {
      url: this.server.url,
      path,
      token: token ?? this.server.accessToken,
      statusCodeExpected: expectedStatus ?? this.expectedStatus ?? defaultExpectedStatus
    }
  }
}

export {
  AbstractCommand
}
