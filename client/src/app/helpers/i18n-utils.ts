import IntlMessageFormat from 'intl-messageformat'
import { logger } from '@root-helpers/logger'
import { environment } from '../../environments/environment'

function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

function getDevLocale () {
  return 'fr-FR'
}

function prepareIcu (icu: string) {
  let alreadyWarned = false

  try {
    const msg = new IntlMessageFormat(icu, $localize.locale)

    return (context: { [id: string]: number | string }, fallback: string) => {
      try {
        return msg.format(context) as string
      } catch (err) {
        if (!alreadyWarned) logger.warn(`Cannot format ICU ${icu}.`, err)

        alreadyWarned = true
        return fallback
      }
    }
  } catch (err) {
    logger.warn(`Cannot build intl message ${icu}.`, err)

    return (_context: unknown, fallback: string) => fallback
  }
}

export {
  getDevLocale,
  prepareIcu,
  isOnDevLocale
}
