import validator from 'validator'
import { SearchTargetType } from '@shared/models/search/search-target-query.model'
import { isArray, exists } from './misc'
import { CONFIG } from '@server/initializers/config'

function isNumberArray (value: any) {
  return isArray(value) && value.every(v => validator.isInt('' + v))
}

function isStringArray (value: any) {
  return isArray(value) && value.every(v => typeof v === 'string')
}

function isNSFWQueryValid (value: any) {
  return value === 'true' || value === 'false' || value === 'both'
}

function isSearchTargetValid (value: SearchTargetType) {
  if (!exists(value)) return true

  const searchIndexConfig = CONFIG.SEARCH.SEARCH_INDEX

  if (value === 'local' && (!searchIndexConfig.ENABLED || !searchIndexConfig.DISABLE_LOCAL_SEARCH)) return true

  if (value === 'search-index' && searchIndexConfig.ENABLED) return true

  return false
}

// ---------------------------------------------------------------------------

export {
  isNumberArray,
  isStringArray,
  isNSFWQueryValid,
  isSearchTargetValid
}
