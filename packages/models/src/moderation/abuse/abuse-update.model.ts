import { AbuseStateType } from './abuse-state.model.js'

export interface AbuseUpdate {
  moderationComment?: string

  state?: AbuseStateType
}
