import { Account } from '../../actors/account.model'
import { AbuseState } from './abuse-state.model'
import { AbusePredefinedReasonsString } from './abuse-reason.model'
import { VideoConstant } from '../../videos/video-constant.model'
import { VideoChannel } from '../../videos/channel/video-channel.model'

export interface AdminVideoAbuse {
  id: number
  name: string
  uuid: string
  nsfw: boolean

  deleted: boolean
  blacklisted: boolean

  startAt: number | null
  endAt: number | null

  thumbnailPath?: string
  channel?: VideoChannel

  countReports: number
  nthReport: number
}

export interface AdminVideoCommentAbuse {
  id: number
  threadId: number

  video: {
    id: number
    name: string
    uuid: string
  }

  text: string

  deleted: boolean
}

export interface AdminAbuse {
  id: number

  reason: string
  predefinedReasons?: AbusePredefinedReasonsString[]

  reporterAccount: Account
  flaggedAccount: Account

  state: VideoConstant<AbuseState>
  moderationComment?: string

  video?: AdminVideoAbuse
  comment?: AdminVideoCommentAbuse

  createdAt: Date
  updatedAt: Date

  countReportsForReporter?: number
  countReportsForReportee?: number

  countMessages: number

  // FIXME: deprecated in 2.3, remove the following properties

  // @deprecated
  startAt?: null
  // @deprecated
  endAt?: null

  // @deprecated
  count?: number
  // @deprecated
  nth?: number
}

export type UserVideoAbuse = Omit<AdminVideoAbuse, 'countReports' | 'nthReport'>

export type UserVideoCommentAbuse = AdminVideoCommentAbuse

export type UserAbuse = Omit<AdminAbuse, 'reporterAccount' | 'countReportsForReportee' | 'countReportsForReporter' | 'startAt' | 'endAt'
| 'count' | 'nth' | 'moderationComment'>
