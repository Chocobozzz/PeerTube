import { LiveVideoLatencyMode } from '@shared/models'

function isLiveLatencyModeValid (value: any) {
  return [ LiveVideoLatencyMode.DEFAULT, LiveVideoLatencyMode.SMALL_LATENCY, LiveVideoLatencyMode.HIGH_LATENCY ].includes(value)
}

// ---------------------------------------------------------------------------

export {
  isLiveLatencyModeValid
}
