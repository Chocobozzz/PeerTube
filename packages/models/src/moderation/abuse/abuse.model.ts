import { Account } from '../../actors/account.model.js'
import { VideoChannel } from '../../videos/channel/video-channel.model.js'
import { Thumbnail } from '../../videos/index.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
import { AbusePredefinedReasonsString } from './abuse-reason.model.js'
import { AbuseStateType } from './abuse-state.model.js'

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

  /**
   * @deprecated use thumbnails instead
   */
  thumbnailPath?: string

  thumbnails: Thumbnail[]

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

  state: ConstantLabel<AbuseStateType>
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
