export type VideoRedundancyStrategy = 'most-views' | 'trending'

export interface VideosRedundancy {
  strategy: VideoRedundancyStrategy
  size: number
}
