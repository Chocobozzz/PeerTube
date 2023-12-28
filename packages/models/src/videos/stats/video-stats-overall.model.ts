export interface VideoStatsOverall {
  averageWatchTime: number
  totalWatchTime: number

  totalViewers: number

  viewersPeak: number
  viewersPeakDate: string

  countries: {
    isoCode: string
    viewers: number
  }[]

  subdivisions: {
    name: string
    viewers: number
  }[]
}
