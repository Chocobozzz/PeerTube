import { Segment } from '@peertube/p2p-media-loader-core'
import { RedundancyUrlManager } from './redundancy-url-manager'

export function segmentUrlBuilderFactory (redundancyUrlManager: RedundancyUrlManager | null) {
  return function segmentBuilder (segment: Segment) {
    if (!redundancyUrlManager) return segment.url

    return redundancyUrlManager.buildUrl(segment.url)
  }
}
