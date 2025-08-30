export function isBrowseVideosDefaultSortValid (value: string, enabledTrendingAlgorithms: string[]) {
  const availableOptions = [ '-publishedAt', '-originallyPublishedAt', 'name', '-trending', '-hot', '-likes', '-views' ]

  if (availableOptions.includes(value) === false) {
    return {
      isValid: false,
      validationError: `Browse videos default sort should be '${availableOptions.join('\' or \'')}', instead of '${value}'`
    }
  }

  const trendingSortAlgorithmMap = new Map<string, string>([
    [ '-trending', 'most-viewed' ],
    [ '-hot', 'hot' ],
    [ '-likes', 'most-liked' ]
  ])
  const currentTrendingSortAlgorithm = trendingSortAlgorithmMap.get(value)

  if (currentTrendingSortAlgorithm && enabledTrendingAlgorithms.includes(currentTrendingSortAlgorithm) === false) {
    return {
      isValid: false,
      validationError:
        `Trending videos algorithm '${currentTrendingSortAlgorithm}' should be enabled if browse videos default sort is '${value}'`
    }
  }

  return { isValid: true, validationError: null }
}

export function isBrowseVideosDefaultScopeValid (value: string) {
  const availableOptions = [ 'local', 'federated' ]

  if (availableOptions.includes(value) === false) {
    return {
      isValid: false,
      validationError: `Browse videos default scope should be '${availableOptions.join('\' or \'')}', instead of '${value}'`
    }
  }

  return { isValid: true, validationError: null }
}
