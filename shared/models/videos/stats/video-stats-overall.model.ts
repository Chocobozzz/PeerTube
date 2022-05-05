export interface VideoStatsOverall {
  averageWatchTime: number
  totalWatchTime: number

  viewersPeak: number
  viewersPeakDate: string

  countries: {
    isoCode: string
    viewers: number
  }[]
}
