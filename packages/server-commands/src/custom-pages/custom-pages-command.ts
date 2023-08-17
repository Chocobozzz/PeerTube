import { CustomPage, HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class CustomPagesCommand extends AbstractCommand {

  getInstanceHomepage (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/custom-pages/homepage/instance'

    return this.getRequestBody<CustomPage>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  updateInstanceHomepage (options: OverrideCommandOptions & {
    content: string
  }) {
    const { content } = options
    const path = '/api/v1/custom-pages/homepage/instance'

    return this.putBodyRequest({
      ...options,

      path,
      fields: { content },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
