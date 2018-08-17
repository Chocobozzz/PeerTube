import { VideoAbuseState } from './video-abuse-state.model'

export interface VideoAbuseUpdate {
  moderationComment?: string
  state?: VideoAbuseState
}
