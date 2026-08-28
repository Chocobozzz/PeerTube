export type VideoLifecycleCriterionType = 'views-since'

export interface VideoLifecycleViewsSinceCriterion {
  type: 'views-since'

  operator: 'lte' | 'gte'
  count: number
  days: number
}

export type VideoLifecycleCriterion = VideoLifecycleViewsSinceCriterion
