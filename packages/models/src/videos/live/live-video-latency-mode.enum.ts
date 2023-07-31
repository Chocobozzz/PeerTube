export const LiveVideoLatencyMode = {
  DEFAULT: 1,
  HIGH_LATENCY: 2,
  SMALL_LATENCY: 3
} as const

export type LiveVideoLatencyModeType = typeof LiveVideoLatencyMode[keyof typeof LiveVideoLatencyMode]
