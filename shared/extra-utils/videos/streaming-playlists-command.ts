
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { unwrapBody, unwrapText } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class StreamingPlaylistsCommand extends AbstractCommand {

  get (options: OverrideCommandOptions & {
    url: string
  }) {
    return unwrapText(this.getRawRequest({
      ...options,

      url: options.url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  getSegment (options: OverrideCommandOptions & {
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
    return unwrapBody<{ [ id: string ]: string }>(this.getRawRequest({
      ...options,

      url: options.url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }
}
