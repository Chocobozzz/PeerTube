import { t } from '../i18n.js'

export function getBrowseVideosDefaultSortError (value: string, enabledTrendingAlgorithms: string[], language?: string) {
  const availableOptions = [ '-publishedAt', '-originallyPublishedAt', 'name', '-trending', '-hot', '-likes', '-views' ]

  if (availableOptions.includes(value) === false) {
    const options = availableOptions.join(' or ')

    // Only use `t` if language is provided, because i18n might not be initialized yet and can return `undefined`
    if (language) {
      return t('Browse videos default sort should be {options}, instead of {value}', language, { options, value })
    }

    return `Browse videos default sort should be ${options}, instead of ${value}`
  }

  const trendingSortAlgorithmMap = new Map<string, string>([
    [ '-trending', 'most-viewed' ],
    [ '-hot', 'hot' ],
    [ '-likes', 'most-liked' ]
  ])
  const currentTrendingSortAlgorithm = trendingSortAlgorithmMap.get(value)

  if (currentTrendingSortAlgorithm && enabledTrendingAlgorithms.includes(currentTrendingSortAlgorithm) === false) {
    if (language) {
      return t(
        'Trending videos algorithm {currentTrendingSortAlgorithm} should be enabled if browse videos default sort is {value}',
        language,
        { currentTrendingSortAlgorithm, value }
      )
    }

    return `Trending videos algorithm ${currentTrendingSortAlgorithm} should be enabled if browse videos default sort is ${value}`
  }

  return null
}

export function getBrowseVideosDefaultScopeError (value: string, language?: string) {
  const availableOptions = [ 'local', 'federated' ]

  if (availableOptions.includes(value) === false) {
    const options = availableOptions.join(' or ')

    if (language) {
      return t('Browse videos default scope should be {options}, instead of {value}', language, { options, value })
    }

    return `Browse videos default scope should be ${options}, instead of ${value}`
  }

  return null
}
