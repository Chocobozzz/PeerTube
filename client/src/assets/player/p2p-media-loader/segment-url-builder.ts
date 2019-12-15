import { Segment } from 'p2p-media-loader-core'
import { RedundancyUrlManager } from './redundancy-url-manager'

function segmentUrlBuilderFactory (redundancyUrlManager: RedundancyUrlManager) {
  return function segmentBuilder (segment: Segment) {
    return redundancyUrlManager.buildUrl(segment.url)
  }
}

// ---------------------------------------------------------------------------

export {
  segmentUrlBuilderFactory
}
