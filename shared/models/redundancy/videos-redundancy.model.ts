export type VideoRedundancyStrategy = 'most-views'

export interface VideosRedundancy {
  strategy: VideoRedundancyStrategy
  size: number
}
