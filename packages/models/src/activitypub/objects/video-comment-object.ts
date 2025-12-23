import { ActivityPubAttributedTo, ActivityTagObject } from './common-objects.js'

export interface VideoCommentObject {
  type: 'Note'
  id: string

  content: string
  mediaType: 'text/markdown'

  inReplyTo: string
  published: string
  updated: string
  url: string
  attributedTo: ActivityPubAttributedTo
  tag: ActivityTagObject[]

  replyApproval: string | null

  to?: string[]
  cc?: string[]
}
