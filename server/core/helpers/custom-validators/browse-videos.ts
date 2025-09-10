import { t } from '../i18n.js'

export function getBrowseVideosDefaultSortError (value: string, enabledTrendingAlgorithms: string[], language: string) {
  const availableOptions = [ '-publishedAt', '-originallyPublishedAt', 'name', '-trending', '-hot', '-likes', '-views' ]

  if (availableOptions.includes(value) === false) {
    return t('Browse videos default sort should be \'' + availableOptions.join('\' or \'') + '\', instead of \'' + value + '\'', language)
  }

  const trendingSortAlgorithmMap = new Map<string, string>([
    [ '-trending', 'most-viewed' ],
    [ '-hot', 'hot' ],
    [ '-likes', 'most-liked' ]
  ])
  const currentTrendingSortAlgorithm = trendingSortAlgorithmMap.get(value)

  if (currentTrendingSortAlgorithm && enabledTrendingAlgorithms.includes(currentTrendingSortAlgorithm) === false) {
    return t(
      `Trending videos algorithm '${currentTrendingSortAlgorithm}' should be enabled if browse videos default sort is '${value}'`,
      language
    )
  }

  return null
}

export function getBrowseVideosDefaultScopeError (value: string, language: string) {
  const availableOptions = [ 'local', 'federated' ]

  if (availableOptions.includes(value) === false) {
    return t('Browse videos default scope should be \'' + availableOptions.join('\' or \'') + '\', instead of \'' + value + '\'', language)
  }

  return null
}
