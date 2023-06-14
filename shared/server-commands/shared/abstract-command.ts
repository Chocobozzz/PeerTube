import { isAbsolute, join } from 'path'
import { root } from '@shared/core-utils'
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

  // Common optional request parameters
  contentType?: string
  accept?: string
  redirects?: number
  range?: string
  host?: string
  headers?: { [ name: string ]: string }
  requestType?: string
  responseType?: string
  xForwardedFor?: string
}

interface InternalGetCommandOptions extends InternalCommonCommandOptions {
  query?: { [ id: string ]: any }
}

interface InternalDeleteCommandOptions extends InternalCommonCommandOptions {
  query?: { [ id: string ]: any }
  rawQuery?: string
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
      defaultExpectedStatus: this.buildExpectedStatus(options),

      url: `${protocol}//${host}`,
      path: pathname,
      range
    })
  }

  protected getRequest (options: InternalGetCommandOptions) {
    const { query } = options

    return makeGetRequest({
      ...this.buildCommonRequestOptions(options),

      query
    })
  }

  protected deleteRequest (options: InternalDeleteCommandOptions) {
    const { query, rawQuery } = options

    return makeDeleteRequest({
      ...this.buildCommonRequestOptions(options),

      query,
      rawQuery
    })
  }

  protected putBodyRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    headers?: { [name: string]: string }
  }) {
    const { fields, headers } = options

    return makePutBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields,
      headers
    })
  }

  protected postBodyRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    headers?: { [name: string]: string }
  }) {
    const { fields, headers } = options

    return makePostBodyRequest({
      ...this.buildCommonRequestOptions(options),

      fields,
      headers
    })
  }

  protected postUploadRequest (options: InternalCommonCommandOptions & {
    fields?: { [ fieldName: string ]: any }
    attaches?: { [ fieldName: string ]: any }
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
    attaches?: { [ fieldName: string ]: any }
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
    const filePath = isAbsolute(options.fixture)
      ? options.fixture
      : join(root(), 'server', 'tests', 'fixtures', options.fixture)

    return this.postUploadRequest({
      ...options,

      fields: {},
      attaches: { [options.fieldname]: filePath }
    })
  }

  protected buildCommonRequestOptions (options: InternalCommonCommandOptions) {
    const { url, path, redirects, contentType, accept, range, host, headers, requestType, xForwardedFor, responseType } = options

    return {
      url: url ?? this.server.url,
      path,

      token: this.buildCommonRequestToken(options),
      expectedStatus: this.buildExpectedStatus(options),

      redirects,
      contentType,
      range,
      host,
      accept,
      headers,
      type: requestType,
      responseType,
      xForwardedFor
    }
  }

  protected buildCommonRequestToken (options: Pick<InternalCommonCommandOptions, 'token' | 'implicitToken'>) {
    const { token } = options

    const fallbackToken = options.implicitToken
      ? this.server.accessToken
      : undefined

    return token !== undefined ? token : fallbackToken
  }

  protected buildExpectedStatus (options: Pick<InternalCommonCommandOptions, 'expectedStatus' | 'defaultExpectedStatus'>) {
    const { expectedStatus, defaultExpectedStatus } = options

    return expectedStatus !== undefined ? expectedStatus : defaultExpectedStatus
  }

  protected buildVideoPasswordHeader (videoPassword: string) {
    return videoPassword !== undefined && videoPassword !== null
      ? { 'x-peertube-video-password': videoPassword }
      : undefined
  }
}

export {
  AbstractCommand
}
