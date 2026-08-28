import { VideoLifecycleAction } from './video-lifecycle-action.model.js'
import { VideoLifecycleCriterion } from './video-lifecycle-criterion.model.js'

export interface VideoLifecyclePolicy {
  // Unique across policies, used in logs
  name: string

  criteria: VideoLifecycleCriterion[]

  action: VideoLifecycleAction
}
