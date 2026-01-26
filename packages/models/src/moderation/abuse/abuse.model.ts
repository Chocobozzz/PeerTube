import { Account } from '../../actors/account.model.js'
import { AbuseStateType } from './abuse-state.model.js'
import { AbusePredefinedReasonsString } from './abuse-reason.model.js'
import { VideoConstant } from '../../videos/video-constant.model.js'
import { VideoChannel } from '../../videos/channel/video-channel.model.js'

export interface AdminVideoAbuse {
  id: number
  name: string
  uuid: string
  shortUUID: string
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

  state: VideoConstant<AbuseStateType>
  moderationComment?: string

  video?: AdminVideoAbuse
  comment?: AdminVideoCommentAbuse

  createdAt: Date
  updatedAt: Date

  countReportsForReporter?: number
  countReportsForReportee?: number

  countMessages: number
}

export type UserVideoAbuse = Omit<AdminVideoAbuse, 'countReports' | 'nthReport'>

export type UserVideoCommentAbuse = AdminVideoCommentAbuse

export type UserAbuse = Omit<
  AdminAbuse,
  'reporterAccount' | 'countReportsForReportee' | 'countReportsForReporter' | 'startAt' | 'endAt' | 'count' | 'nth' | 'moderationComment'
>
