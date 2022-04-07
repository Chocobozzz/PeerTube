import { VideoStatsTimeserieGroupInterval } from './video-stats-timeserie-group-interval.type'

export interface VideoStatsTimeserie {
  groupInterval: VideoStatsTimeserieGroupInterval

  data: {
    date: string
    value: number
  }[]
}
