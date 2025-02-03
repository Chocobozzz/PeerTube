export type VideoStatsUserAgent = {
  [key in 'browser' | 'device' | 'operatingSystem']: {
    name: string
    viewers: number
  }[]
}
