export type VideoStatsUserAgent = {
  [key in 'clients' | 'devices' | 'operatingSystems']: {
    name: string
    viewers: number
  }[]
}

export type VideoStatsUserAgentDevice = 'console' | 'embedded' | 'mobile' | 'smarttv' | 'tablet' | 'wearable' | 'xr' | 'desktop'
