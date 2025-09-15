import { t } from '../i18n.js'

export function getBrowseVideosDefaultSortError (value: string, enabledTrendingAlgorithms: string[], language?: string) {
  const availableOptions = [ '-publishedAt', '-originallyPublishedAt', 'name', '-trending', '-hot', '-likes', '-views' ]

  if (availableOptions.includes(value) === false) {
    const error = 'Browse videos default sort should be \'' + availableOptions.join('\' or \'') + '\', instead of \'' + value + '\''
    return language ? t(error, language) : error
  }

  const trendingSortAlgorithmMap = new Map<string, string>([
    [ '-trending', 'most-viewed' ],
    [ '-hot', 'hot' ],
    [ '-likes', 'most-liked' ]
  ])
  const currentTrendingSortAlgorithm = trendingSortAlgorithmMap.get(value)

  if (currentTrendingSortAlgorithm && enabledTrendingAlgorithms.includes(currentTrendingSortAlgorithm) === false) {
    const error =
      `Trending videos algorithm '${currentTrendingSortAlgorithm}' should be enabled if browse videos default sort is '${value}'`
    return language ? t(error, language) : error
  }

  return null
}

export function getBrowseVideosDefaultScopeError (value: string, language?: string) {
  const availableOptions = [ 'local', 'federated' ]

  if (availableOptions.includes(value) === false) {
    const error = 'Browse videos default scope should be \'' + availableOptions.join('\' or \'') + '\', instead of \'' + value + '\''
    return language ? t(error, language) : error
  }

  return null
}
