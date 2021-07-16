import { isAbsolute, join } from 'path'
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
import { PeerTubeServer } from '../server/server'

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

  constructor (
    protected server: PeerTubeServer
  ) {

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
    headers?: { [ name: string ]: string }
    type?: string
    xForwardedFor?: string
  }) {
    const { type, fields, xForwardedFor, headers } = options

    return makePostBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields,
      xForwardedFor,
      type,
      headers
    })
  }

  protected postUploadRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    attaches?: { [ fieldName: string ]: any }
    headers?: { [ name: string ]: string }
  }) {
    const { fields, attaches, headers } = options

    return makeUploadRequest({
      ...this.buildCommonRequestOptions(options),

      method: 'POST',
      fields,
      attaches,
      headers
    })
  }

  protected putUploadRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    attaches?: { [ fieldName: string ]: any }
    headers?: { [ name: string ]: string }
  }) {
    const { fields, attaches, headers } = options

    return makeUploadRequest({
      ...this.buildCommonRequestOptions(options),

      method: 'PUT',
      headers,
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

  protected buildCommonRequestOptions (options: InternalCommonCommandOptions) {
    const { url, path } = options

    return {
      url: url ?? this.server.url,
      path,

      token: this.buildCommonRequestToken(options),
      statusCodeExpected: this.buildStatusCodeExpected(options)
    }
  }

  protected buildCommonRequestToken (options: Pick<InternalCommonCommandOptions, 'token' | 'implicitToken'>) {
    const { token } = options

    const fallbackToken = options.implicitToken
      ? this.server.accessToken
      : undefined

    return token !== undefined ? token : fallbackToken
  }

  protected buildStatusCodeExpected (options: Pick<InternalCommonCommandOptions, 'expectedStatus' | 'defaultExpectedStatus'>) {
    const { expectedStatus, defaultExpectedStatus } = options

    return expectedStatus !== undefined ? expectedStatus : defaultExpectedStatus
  }
}

export {
  AbstractCommand
}
