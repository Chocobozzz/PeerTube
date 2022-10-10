import { wait } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { unwrapBody, unwrapBodyOrDecodeToJSON, unwrapTextOrDecode } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class StreamingPlaylistsCommand extends AbstractCommand {

  async get (options: OverrideCommandOptions & {
    url: string
    withRetry?: boolean // default false
    currentRetry?: number
  }) {
    const { withRetry, currentRetry = 1 } = options

    try {
      const result = await unwrapTextOrDecode(this.getRawRequest({
        ...options,

        url: options.url,
        implicitToken: false,
        defaultExpectedStatus: HttpStatusCode.OK_200
      }))

      return result
    } catch (err) {
      if (!withRetry || currentRetry > 5) throw err

      await wait(100)

      return this.get({
        ...options,

        withRetry,
        currentRetry: currentRetry + 1
      })
    }
  }

  getFragmentedSegment (options: OverrideCommandOptions & {
    url: string
    range?: string
  }) {
    return unwrapBody<Buffer>(this.getRawRequest({
      ...options,

      url: options.url,
      range: options.range,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  getSegmentSha256 (options: OverrideCommandOptions & {
    url: string
  }) {
    return unwrapBodyOrDecodeToJSON<{ [ id: string ]: string }>(this.getRawRequest({
      ...options,

      url: options.url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }
}
