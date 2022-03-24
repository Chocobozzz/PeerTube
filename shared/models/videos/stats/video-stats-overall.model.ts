export interface VideoStatsOverall {
  averageWatchTime: number
  totalWatchTime: number

  viewersPeak: number
  viewersPeakDate: string

  views: number
  likes: number
  dislikes: number
  comments: number

  countries: {
    isoCode: string
    viewers: number
  }[]
}
