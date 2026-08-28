import { VideoLifecycleCriterion, VideoLifecycleCriterionType } from '@peertube/peertube-models'
import { LifecycleCriterionHandler } from './criterion.model.js'
import { viewsSinceCriterion } from './views-since.js'

const criterionHandlers: { [T in VideoLifecycleCriterionType]: LifecycleCriterionHandler<any> } = {
  'views-since': viewsSinceCriterion
}

export function getCriterionHandler (criterion: VideoLifecycleCriterion) {
  // Don't resolve inherited object properties (constructor, toString...)
  if (!criterion?.type || Object.hasOwn(criterionHandlers, criterion.type) !== true) return undefined

  return criterionHandlers[criterion.type] as LifecycleCriterionHandler<VideoLifecycleCriterion>
}

export function getCriterionTypes () {
  return Object.keys(criterionHandlers)
}

export * from './criterion.model.js'
