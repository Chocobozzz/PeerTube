import { wait } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { unwrapBody, unwrapBodyOrDecodeToJSON, unwrapTextOrDecode } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class StreamingPlaylistsCommand extends AbstractCommand {

  async get (options: OverrideCommandOptions & {
    url: string

    videoFileToken?: string
    reinjectVideoFileToken?: boolean

    withRetry?: boolean // default false
    currentRetry?: number
  }): Promise<string> {
    const { videoFileToken, reinjectVideoFileToken, withRetry = false, currentRetry = 1 } = options

    try {
      const result = await unwrapTextOrDecode(this.getRawRequest({
        ...options,

        url: options.url,
        query: {
          videoFileToken,
          reinjectVideoFileToken
        },
        implicitToken: false,
        defaultExpectedStatus: HttpStatusCode.OK_200
      }))

      return result
    } catch (err) {
      if (!withRetry || currentRetry > 5) throw err

      await wait(250)

      return this.get({
        ...options,

        withRetry,
        currentRetry: currentRetry + 1
      })
    }
  }

  async getFragmentedSegment (options: OverrideCommandOptions & {
    url: string
    range?: string

    withRetry?: boolean // default false
    currentRetry?: number
  }) {
    const { withRetry = false, currentRetry = 1 } = options

    try {
      const result = await unwrapBody<Buffer>(this.getRawRequest({
        ...options,

        url: options.url,
        range: options.range,
        implicitToken: false,
        responseType: 'application/octet-stream',
        defaultExpectedStatus: HttpStatusCode.OK_200
      }))

      return result
    } catch (err) {
      if (!withRetry || currentRetry > 5) throw err

      await wait(250)

      return this.getFragmentedSegment({
        ...options,

        withRetry,
        currentRetry: currentRetry + 1
      })
    }
  }

  async getSegmentSha256 (options: OverrideCommandOptions & {
    url: string

    withRetry?: boolean // default false
    currentRetry?: number
  }) {
    const { withRetry = false, currentRetry = 1 } = options

    try {
      const result = await unwrapBodyOrDecodeToJSON<{ [ id: string ]: string }>(this.getRawRequest({
        ...options,

        url: options.url,
        contentType: 'application/json',
        implicitToken: false,
        defaultExpectedStatus: HttpStatusCode.OK_200
      }))

      return result
    } catch (err) {
      if (!withRetry || currentRetry > 5) throw err

      await wait(250)

      return this.getSegmentSha256({
        ...options,

        withRetry,
        currentRetry: currentRetry + 1
      })
    }
  }
}
