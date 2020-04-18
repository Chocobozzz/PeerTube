import { Account } from '../../actors/index'
import { VideoConstant } from '../video-constant.model'
import { VideoAbuseState } from './video-abuse-state.model'
import { VideoChannel } from '../channel/video-channel.model'

export interface VideoAbuse {
  id: number
  reason: string
  reporterAccount: Account

  state: VideoConstant<VideoAbuseState>
  moderationComment?: string

  video: {
    id: number
    name: string
    uuid: string
    nsfw: boolean
    deleted: boolean
    blacklisted: boolean
    thumbnailPath?: string
    channel?: VideoChannel
  }

  createdAt: Date
  updatedAt: Date

  count?: number
  nth?: number

  countReportsForReporter?: number
  countReportsForReportee?: number
}
