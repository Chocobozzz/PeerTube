
import { BulkRemoveCommentsOfBody } from '@shared/models/bulk/bulk-remove-comments-of-body.model'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { AbstractCommand, CommonCommandOptions } from '../shared'

class BulkCommand extends AbstractCommand {

  removeCommentsOf (options: CommonCommandOptions & {
    attributes: BulkRemoveCommentsOfBody
  }) {
    const { attributes } = options

    return this.postBodyRequest({
      ...options,
      path: '/api/v1/bulk/remove-comments-of',
      fields: attributes,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}

export {
  BulkCommand
}
