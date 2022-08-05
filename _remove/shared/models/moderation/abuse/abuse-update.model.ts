import { AbuseState } from './abuse-state.model'

export interface AbuseUpdate {
  moderationComment?: string

  state?: AbuseState
}
