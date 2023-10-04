import validator from 'validator'
import { SearchTargetType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { exists, isArray } from './misc.js'

function isNumberArray (value: any) {
  return isArray(value) && value.every(v => validator.default.isInt('' + v))
}

function isStringArray (value: any) {
  return isArray(value) && value.every(v => typeof v === 'string')
}

function isBooleanBothQueryValid (value: any) {
  return value === 'true' || value === 'false' || value === 'both'
}

function isSearchTargetValid (value: SearchTargetType) {
  if (!exists(value)) return true

  const searchIndexConfig = CONFIG.SEARCH.SEARCH_INDEX

  if (value === 'local') return true

  if (value === 'search-index' && searchIndexConfig.ENABLED) return true

  return false
}

// ---------------------------------------------------------------------------

export {
  isNumberArray,
  isStringArray,
  isBooleanBothQueryValid,
  isSearchTargetValid
}
