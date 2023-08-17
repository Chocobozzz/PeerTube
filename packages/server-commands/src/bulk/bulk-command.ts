import { BulkRemoveCommentsOfBody, HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class BulkCommand extends AbstractCommand {

  removeCommentsOf (options: OverrideCommandOptions & {
    attributes: BulkRemoveCommentsOfBody
  }) {
    const { attributes } = options

    return this.postBodyRequest({
      ...options,

      path: '/api/v1/bulk/remove-comments-of',
      fields: attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
