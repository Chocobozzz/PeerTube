import { HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ServicesCommand extends AbstractCommand {
  getOEmbed (
    options: OverrideCommandOptions & {
      oembedUrl: string
      format?: string
      maxHeight?: number
      maxWidth?: number
    }
  ) {
    const path = '/services/oembed'
    const query = {
      url: options.oembedUrl,
      format: options.format,
      maxheight: options.maxHeight,
      maxwidth: options.maxWidth
    }

    return this.getRequest({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async getActorRedirection (
    options: OverrideCommandOptions & {
      handle: string
      type: 'actors' | 'accounts'
    }
  ) {
    const path = `/services/redirect/${options.type}/${encodeURIComponent(options.handle)}`

    const res = await this.getRequest({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.FOUND_302
    })

    if (options.expectedStatus !== HttpStatusCode.NOT_FOUND_404) {
      return res.headers['location']
    }

    return undefined
  }
}
