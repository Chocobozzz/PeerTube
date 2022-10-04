import { HttpStatusCode } from '@shared/models'
import { unwrapBody, unwrapTextOrDecode, unwrapBodyOrDecodeToJSON } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class StreamingPlaylistsCommand extends AbstractCommand {

  get (options: OverrideCommandOptions & {
    url: string
  }) {
    return unwrapTextOrDecode(this.getRawRequest({
      ...options,

      url: options.url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
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
