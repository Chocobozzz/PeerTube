import { SafeHtml } from '@angular/platform-browser'
import { AdminAbuse } from '@shared/models'
import { Account } from '@app/shared/shared-main'

// Don't use an abuse model because we need external services to compute some properties
// And this model is only used in this component
export type ProcessedAbuse = AdminAbuse & {
  moderationCommentHtml?: string,
  reasonHtml?: string
  embedHtml?: SafeHtml
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
