export type VideoRedundancyStrategy = 'most-views' | 'trending' | 'recently-added'

export type MostViewsRedundancyStrategy = {
  strategy: 'most-views'
  size: number
}

export type TrendingRedundancyStrategy = {
  strategy: 'trending'
  size: number
}

export type RecentlyAddedStrategy = {
  strategy: 'recently-added'
  size: number
  minViews: number
}

export type VideosRedundancy = MostViewsRedundancyStrategy | TrendingRedundancyStrategy | RecentlyAddedStrategy
