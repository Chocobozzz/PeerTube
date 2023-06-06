import IntlMessageFormat from 'intl-messageformat'
import { shouldPolyfill as shouldPolyfillLocale } from '@formatjs/intl-locale/should-polyfill'
import { shouldPolyfill as shouldPolyfillPlural } from '@formatjs/intl-pluralrules/should-polyfill'
import { logger } from '@root-helpers/logger'
import { environment } from '../../environments/environment'

function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

function getDevLocale () {
  return 'fr-FR'
}

async function polyfillICU () {
  // Important to be in this order, Plural needs Locale (https://formatjs.io/docs/polyfills/intl-pluralrules)
  await polyfillICULocale()
  await polyfillICUPlural()
}

async function polyfillICULocale () {
  // This locale is supported
  if (shouldPolyfillLocale()) {
    // TODO: remove, it's only needed to support Plural polyfill and so iOS 12
    console.log('Loading Intl Locale polyfill for ' + $localize.locale)

    await import('@formatjs/intl-locale/polyfill')
  }
}

async function polyfillICUPlural () {
  const unsupportedLocale = shouldPolyfillPlural($localize.locale)

  // This locale is supported
  if (!unsupportedLocale) {
    return
  }

  // TODO: remove, it's only needed to support iOS 12
  console.log('Loading Intl Plural rules polyfill for ' + $localize.locale)

  // Load the polyfill 1st BEFORE loading data
  await import('@formatjs/intl-pluralrules/polyfill-force')
  // Degraded mode, so only load the en local data
  await import(`@formatjs/intl-pluralrules/locale-data/en.js`)
}

// ---------------------------------------------------------------------------

const icuCache = new Map<string, IntlMessageFormat>()
const icuWarnings = new Set<string>()
const fallback = 'String translation error'

function formatICU (icu: string, context: { [id: string]: number | string }) {
  try {
    let msg = icuCache.get(icu)

    if (!msg) {
      msg = new IntlMessageFormat(icu, $localize.locale)
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

export {
  getDevLocale,
  polyfillICU,
  formatICU,
  isOnDevLocale
}
