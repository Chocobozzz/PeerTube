import { Account } from '../../actors/index'
import { VideoConstant } from '../video-constant.model'
import { VideoAbuseState } from './video-abuse-state.model'

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
  }

  createdAt: Date
}
