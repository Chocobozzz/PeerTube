export type VideoRedundancyStrategy = 'most-views' | 'trending' | 'recently-added'
export type VideoRedundancyStrategyWithManual = VideoRedundancyStrategy | 'manual'

export type MostViewsRedundancyStrategy = {
  strategy: 'most-views'
  size: number
  minLifetime: number
}

export type TrendingRedundancyStrategy = {
  strategy: 'trending'
  size: number
  minLifetime: number
}

export type RecentlyAddedStrategy = {
  strategy: 'recently-added'
  size: number
  minViews: number
  minLifetime: number
}

export type VideosRedundancyStrategy = MostViewsRedundancyStrategy | TrendingRedundancyStrategy | RecentlyAddedStrategy
