import { HttpStatusCode } from '@shared/core-utils'
import {
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  unwrapBody,
  unwrapText
} from '../requests/requests'
import { ServerInfo } from '../server/servers'

export interface OverrideCommandOptions {
  token?: string
  expectedStatus?: number
}

interface InternalCommonCommandOptions extends OverrideCommandOptions {
  path: string
  // If we automatically send the server token if the token is not provided
  implicitToken: boolean
  defaultExpectedStatus: number
}

interface InternalGetCommandOptions extends InternalCommonCommandOptions {
  query?: { [ id: string ]: any }
  contentType?: string
  accept?: string
  redirects?: number
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

  protected getRequestBody <T> (options: InternalGetCommandOptions) {
    return unwrapBody<T>(this.getRequest(options))
  }

  protected getRequestText (options: InternalGetCommandOptions) {
    return unwrapText(this.getRequest(options))
  }

  protected getRequest (options: InternalGetCommandOptions) {
    const { redirects, query, contentType, accept } = options

    return makeGetRequest({
      ...this.buildCommonRequestOptions(options),

      redirects,
      query,
      contentType,
      accept
    })
  }

  protected deleteRequest (options: InternalCommonCommandOptions) {
    return makeDeleteRequest(this.buildCommonRequestOptions(options))
  }

  protected putBodyRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
  }) {
    const { fields } = options

    return makePutBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields
    })
  }

  protected postBodyRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
  }) {
    const { fields } = options

    return makePostBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields
    })
  }

  protected postUploadRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    attaches?: any
  }) {
    const { fields, attaches } = options

    return makeUploadRequest({
      ...this.buildCommonRequestOptions(options),

      method: 'POST',
      fields,
      attaches
    })
  }

  protected putUploadRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    attaches?: any
  }) {
    const { fields, attaches } = options

    return makeUploadRequest({
      ...this.buildCommonRequestOptions(options),

      method: 'PUT',
      fields,
      attaches
    })
  }

  private buildCommonRequestOptions (options: InternalCommonCommandOptions) {
    const { token, expectedStatus, defaultExpectedStatus, path } = options

    const fallbackToken = options.implicitToken
      ? this.server.accessToken
      : undefined

    return {
      url: this.server.url,
      path,

      token: token !== undefined ? token : fallbackToken,

      statusCodeExpected: expectedStatus ?? this.expectedStatus ?? defaultExpectedStatus
    }
  }
}

export {
  AbstractCommand
}
