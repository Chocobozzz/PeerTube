import { BulkRemoveCommentsOfBody } from '@peertube/peertube-models'

export function isBulkRemoveCommentsOfScopeValid (value: BulkRemoveCommentsOfBody['scope']) {
  return value === 'my-videos' || value === 'instance' || value === 'my-videos-and-collaborations'
}
