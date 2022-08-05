import { ActivityTagObject } from './common-objects'

export interface VideoCommentObject {
  type: 'Note'
  id: string

  content: string
  mediaType: 'text/markdown'

  inReplyTo: string
  published: string
  updated: string
  url: string
  attributedTo: string
  tag: ActivityTagObject[]
}
