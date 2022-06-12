import { Account } from '@app/shared/shared-main'
import { AdminAbuse } from '@shared/models'

// Don't use an abuse model because we need external services to compute some properties
// And this model is only used in this component
export type ProcessedAbuse = AdminAbuse & {
  moderationCommentHtml?: string
  reasonHtml?: string
  updatedAt?: Date

  // override bare server-side definitions with rich client-side definitions
  reporterAccount?: Account
  flaggedAccount?: Account

  truncatedCommentHtml?: string
  commentHtml?: string

  video: AdminAbuse['video'] & {
    channel: AdminAbuse['video']['channel'] & {
      ownerAccount: Account
    }
  }
}
