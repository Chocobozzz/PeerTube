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

function checkBooleanBothQuery (value: any) {
  const acceptableValues = [ 'true', 'false', 'both' ]
  if (!acceptableValues.includes(value)) throw new Error('Should have the NSFW policy that is one of ' + acceptableValues.join(', '))
  return true
}

function checkSearchTarget (value: SearchTargetType) {
  if (!exists(value)) return true

  const searchIndexConfig = CONFIG.SEARCH.SEARCH_INDEX

  switch (value) {
    case 'local':
      if (searchIndexConfig.ENABLED && searchIndexConfig.DISABLE_LOCAL_SEARCH) {
        throw new Error('Should target search-index since local search is disabled')
      }
      break
    case 'search-index':
      if (!searchIndexConfig.ENABLED) throw new Error('Should target local since search-index is disabled')
      break
    default:
      throw new Error('Should have a known search target: local or search-index')
  }

  return true
}

// ---------------------------------------------------------------------------

export {
  isNumberArray,
  isStringArray,
  checkBooleanBothQuery,
  checkSearchTarget
}
