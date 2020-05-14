import { BulkRemoveCommentsOfBody } from "@shared/models/bulk/bulk-remove-comments-of-body.model"
import { makePostBodyRequest } from "../requests/requests"

function bulkRemoveCommentsOf (options: {
  url: string
  token: string
  attributes: BulkRemoveCommentsOfBody
  expectedStatus?: number
}) {
  const { url, token, attributes, expectedStatus } = options
  const path = '/api/v1/bulk/remove-comments-of'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: attributes,
    statusCodeExpected: expectedStatus || 204
  })
}

export {
  bulkRemoveCommentsOf
}
