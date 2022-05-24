import { environment } from '../../environments/environment'
import IntlMessageFormat from 'intl-messageformat'

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
        if (!alreadyWarned) console.warn('Cannot format ICU %s.', icu, err)

        alreadyWarned = true
        return fallback
      }
    }
  } catch (err) {
    console.warn('Cannot build intl message %s.', icu, err)

    return (_context: unknown, fallback: string) => fallback
  }
}

export {
  getDevLocale,
  prepareIcu,
  isOnDevLocale
}
