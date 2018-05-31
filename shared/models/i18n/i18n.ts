export const I18N_LOCALES = {
  'en-US': 'English (US)',
  fr: 'French'
}

export function getDefaultLocale () {
  return 'en-US'
}

const possiblePaths = Object.keys(I18N_LOCALES).map(l => '/' + l)
export function is18nPath (path: string) {
  return possiblePaths.indexOf(path) !== -1
}

const possibleLanguages = Object.keys(I18N_LOCALES)
export function is18nLocale (locale: string) {
  return possibleLanguages.indexOf(locale) !== -1
}

// Only use in dev mode, so relax
// In production, the locale always match with a I18N_LANGUAGES key
export function buildFileLocale (locale: string) {
  if (!is18nLocale(locale)) {
    // Some working examples for development purpose
    if (locale.split('-')[ 0 ] === 'en') return 'en_US'
    else if (locale === 'fr') return 'fr'
  }

  return locale.replace('-', '_')
}
