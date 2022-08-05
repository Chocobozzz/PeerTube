import { VideoStatsTimeserieMetric } from '@shared/models'

const validMetrics = new Set<VideoStatsTimeserieMetric>([
  'viewers',
  'aggregateWatchTime'
])

function isValidStatTimeserieMetric (value: VideoStatsTimeserieMetric) {
  return validMetrics.has(value)
}

// ---------------------------------------------------------------------------

export {
  isValidStatTimeserieMetric
}
