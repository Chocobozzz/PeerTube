
import { BulkRemoveCommentsOfBody } from '@shared/models/bulk/bulk-remove-comments-of-body.model'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

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
