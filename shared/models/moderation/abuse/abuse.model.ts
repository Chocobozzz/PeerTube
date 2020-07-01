import { Account } from '../../actors/account.model'
import { AbuseState } from './abuse-state.model'
import { AbusePredefinedReasonsString } from './abuse-reason.model'
import { VideoConstant } from '../../videos/video-constant.model'
import { VideoChannel } from '../../videos/channel/video-channel.model'

export interface VideoAbuse {
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
}

export interface VideoCommentAbuse {
  id: number
  account?: Account
  text: string
  deleted: boolean
}

export interface Abuse {
  id: number
  reason: string
  predefinedReasons?: AbusePredefinedReasonsString[]
  reporterAccount: Account

  state: VideoConstant<AbuseState>
  moderationComment?: string

  video?: VideoAbuse
  comment?: VideoCommentAbuse

  createdAt: Date
  updatedAt: Date

  // FIXME: deprecated in 2.3, remove this
  startAt: null
  endAt: null

  count?: number
  nth?: number

  countReportsForReporter?: number
  countReportsForReportee?: number
}
