import { VideoStatsTimeserieMetric } from '@peertube/peertube-models'

const validMetrics = new Set<VideoStatsTimeserieMetric>([
  'viewers',
  'aggregateWatchTime',
  'downloads'
])

function isValidStatTimeserieMetric (value: VideoStatsTimeserieMetric) {
  return validMetrics.has(value)
}

// ---------------------------------------------------------------------------

export {
  isValidStatTimeserieMetric
}
