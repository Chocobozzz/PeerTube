/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath, getFileSize } from '@peertube/peertube-node-utils'
import { expect } from 'chai'
import got, { Response as GotResponse } from 'got'
import { isAbsolute } from 'path'
import {
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  unwrapBody,
  unwrapText
} from '../requests/requests.js'

import { createReadStream } from 'fs'
import type { PeerTubeServer } from '../server/server.js'

export interface OverrideCommandOptions {
  token?: string
  expectedStatus?: HttpStatusCodeType
}

interface InternalCommonCommandOptions extends OverrideCommandOptions {
  // Default to server.url
  url?: string

  path: string
  // If we automatically send the server token if the token is not provided
  implicitToken: boolean
  defaultExpectedStatus: HttpStatusCodeType

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

export abstract class AbstractCommand {

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
      : buildAbsoluteFixturePath(options.fixture)

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

  // ---------------------------------------------------------------------------

  protected async buildResumeUpload <T> (options: OverrideCommandOptions & {
    path: string

    fixture: string
    attaches?: Record<string, string>
    fields?: Record<string, any>

    completedExpectedStatus?: HttpStatusCodeType // When the upload is finished
  }): Promise<T> {
    const { path, fixture, expectedStatus = HttpStatusCode.OK_200, completedExpectedStatus } = options

    let size = 0
    let videoFilePath: string
    let mimetype = 'video/mp4'

    if (fixture) {
      videoFilePath = buildAbsoluteFixturePath(fixture)
      size = await getFileSize(videoFilePath)

      if (videoFilePath.endsWith('.mkv')) {
        mimetype = 'video/x-matroska'
      } else if (videoFilePath.endsWith('.webm')) {
        mimetype = 'video/webm'
      } else if (videoFilePath.endsWith('.zip')) {
        mimetype = 'application/zip'
      }
    }

    // Do not check status automatically, we'll check it manually
    const initializeSessionRes = await this.prepareResumableUpload({
      ...options,

      path,
      expectedStatus: null,

      size,
      mimetype
    })
    const initStatus = initializeSessionRes.status

    if (videoFilePath && initStatus === HttpStatusCode.CREATED_201) {
      const locationHeader = initializeSessionRes.header['location']
      expect(locationHeader).to.not.be.undefined

      const pathUploadId = locationHeader.split('?')[1]

      const result = await this.sendResumableChunks({
        ...options,

        path,
        pathUploadId,
        videoFilePath,
        size,
        expectedStatus: completedExpectedStatus
      })

      if (result.statusCode === HttpStatusCode.OK_200) {
        await this.endResumableUpload({
          ...options,

          expectedStatus: HttpStatusCode.NO_CONTENT_204,
          path,
          pathUploadId
        })
      }

      return result.body as T
    }

    const expectedInitStatus = expectedStatus === HttpStatusCode.OK_200
      ? HttpStatusCode.CREATED_201
      : expectedStatus

    expect(initStatus).to.equal(expectedInitStatus)

    return initializeSessionRes.body.video || initializeSessionRes.body
  }

  protected async prepareResumableUpload (options: OverrideCommandOptions & {
    path: string

    fixture: string
    size: number
    mimetype: string

    attaches?: Record<string, string>
    fields?: Record<string, any>

    originalName?: string
    lastModified?: number
  }) {
    const { path, attaches = {}, fields = {}, originalName, lastModified, fixture, size, mimetype } = options

    const uploadOptions = {
      ...options,

      path,
      headers: {
        'X-Upload-Content-Type': mimetype,
        'X-Upload-Content-Length': size.toString()
      },
      fields: {
        filename: fixture,
        originalName,
        lastModified,

        ...fields
      },

      // Fixture will be sent later
      attaches,
      implicitToken: true,

      defaultExpectedStatus: null
    }

    if (Object.keys(attaches).length === 0) return this.postBodyRequest(uploadOptions)

    return this.postUploadRequest(uploadOptions)
  }

  protected async sendResumableChunks <T> (options: OverrideCommandOptions & {
    pathUploadId: string
    path: string
    videoFilePath: string
    size: number
    contentLength?: number
    contentRangeBuilder?: (start: number, chunk: any) => string
    digestBuilder?: (chunk: any) => string
  }) {
    const {
      path,
      pathUploadId,
      videoFilePath,
      size,
      contentLength,
      contentRangeBuilder,
      digestBuilder,
      expectedStatus = HttpStatusCode.OK_200
    } = options

    let start = 0

    const token = this.buildCommonRequestToken({ ...options, implicitToken: true })

    const readable = createReadStream(videoFilePath, { highWaterMark: 8 * 1024 })
    const server = this.server
    return new Promise<GotResponse<T>>((resolve, reject) => {
      readable.on('data', async function onData (chunk) {
        try {
          readable.pause()

          const byterangeStart = start + chunk.length - 1

          const headers = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/octet-stream',
            'Content-Range': contentRangeBuilder
              ? contentRangeBuilder(start, chunk)
              : `bytes ${start}-${byterangeStart}/${size}`,
            'Content-Length': contentLength ? contentLength + '' : chunk.length + ''
          }

          if (digestBuilder) {
            Object.assign(headers, { digest: digestBuilder(chunk) })
          }

          const res = await got<T>({
            url: new URL(path + '?' + pathUploadId, server.url).toString(),
            method: 'put',
            headers,
            body: chunk,
            responseType: 'json',
            throwHttpErrors: false
          })

          start += chunk.length

          // Last request, check final status
          if (byterangeStart + 1 === size) {
            if (res.statusCode === expectedStatus) {
              return resolve(res)
            }

            if (res.statusCode !== HttpStatusCode.PERMANENT_REDIRECT_308) {
              readable.off('data', onData)

              // eslint-disable-next-line max-len
              const message = `Incorrect transient behaviour sending intermediary chunks. Status code is ${res.statusCode} instead of ${expectedStatus}`
              return reject(new Error(message))
            }
          }

          readable.resume()
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  protected endResumableUpload (options: OverrideCommandOptions & {
    path: string
    pathUploadId: string
  }) {
    return this.deleteRequest({
      ...options,

      path: options.path,
      rawQuery: options.pathUploadId,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
