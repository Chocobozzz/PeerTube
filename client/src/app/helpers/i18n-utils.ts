import { logger } from '@root-helpers/logger'
import IntlMessageFormat from 'intl-messageformat'
import { environment } from '../../environments/environment'

export function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

export function getDevLocale () {
  return 'fr-FR'
}

// ---------------------------------------------------------------------------

type ICUContext = { [id: string]: number | string }

const icuCache = new Map<string, IntlMessageFormat<ICUContext>>()
const icuWarnings = new Set<string>()
const fallback = 'String translation error'

export function formatICU (icu: string, context: ICUContext) {
  try {
    let msg = icuCache.get(icu)

    if (!msg) {
      msg = new IntlMessageFormat<ICUContext>(icu, $localize.locale)
      icuCache.set(icu, msg)
    }

    return msg.format(context) as string
  } catch (err) {
    if (!icuWarnings.has(icu)) {
      logger.warn(`Cannot format ICU ${icu}.`, err)
    }

    icuWarnings.add(icu)
    return fallback
  }
}
