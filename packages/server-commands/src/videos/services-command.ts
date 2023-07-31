import { HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ServicesCommand extends AbstractCommand {

  getOEmbed (options: OverrideCommandOptions & {
    oembedUrl: string
    format?: string
    maxHeight?: number
    maxWidth?: number
  }) {
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
}
