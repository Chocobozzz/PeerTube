import { isAbsolute, join } from 'path'
import { HttpStatusCode } from '@shared/core-utils'
import { root } from '../miscs/tests'
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
  // Default to server.url
  url?: string

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
  range?: string
  host?: string
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

  protected getRawRequest (options: Omit<InternalGetCommandOptions, 'path'>) {
    const { url, range } = options
    const { host, protocol, pathname } = new URL(url)

    return this.getRequest({
      ...options,

      token: this.buildCommonRequestToken(options),
      defaultExpectedStatus: this.buildStatusCodeExpected(options),

      url: `${protocol}//${host}`,
      path: pathname,
      range
    })
  }

  protected getRequest (options: InternalGetCommandOptions) {
    const { redirects, query, contentType, accept, range, host } = options

    return makeGetRequest({
      ...this.buildCommonRequestOptions(options),

      redirects,
      query,
      contentType,
      range,
      host,
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
    type?: string
  }) {
    const { type, fields } = options

    return makePostBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields,
      type
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

  protected updateImageRequest (options: InternalCommonCommandOptions & {
    fixture: string
    fieldname: string
  }) {
    let filePath = ''
    if (isAbsolute(options.fixture)) {
      filePath = options.fixture
    } else {
      filePath = join(root(), 'server', 'tests', 'fixtures', options.fixture)
    }

    return this.postUploadRequest({
      ...options,

      fields: {},
      attaches: { [options.fieldname]: filePath }
    })
  }

  private buildCommonRequestOptions (options: InternalCommonCommandOptions) {
    const { url, path } = options

    return {
      url: url ?? this.server.url,
      path,

      token: this.buildCommonRequestToken(options),
      statusCodeExpected: this.buildStatusCodeExpected(options)
    }
  }

  private buildCommonRequestToken (options: Pick<InternalCommonCommandOptions, 'token' | 'implicitToken'>) {
    const { token } = options

    const fallbackToken = options.implicitToken
      ? this.server.accessToken
      : undefined

    return token !== undefined ? token : fallbackToken
  }

  private buildStatusCodeExpected (options: Pick<InternalCommonCommandOptions, 'expectedStatus' | 'defaultExpectedStatus'>) {
    const { expectedStatus, defaultExpectedStatus } = options

    return expectedStatus ?? this.expectedStatus ?? defaultExpectedStatus
  }
}

export {
  AbstractCommand
}
