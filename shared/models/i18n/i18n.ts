export const LOCALE_FILES = [ 'player', 'server' ]

export const I18N_LOCALES = {
  'en-US': 'English (US)',
  'fr-FR': 'Français (France)'
}

const I18N_LOCALE_ALIAS = {
  'en': 'en-US',
  'fr': 'fr-FR'
}

export const POSSIBLE_LOCALES = Object.keys(I18N_LOCALES)
                                      .concat(Object.keys(I18N_LOCALE_ALIAS))

const possiblePaths = POSSIBLE_LOCALES.map(l => '/' + l)

export function getDefaultLocale () {
  return 'en-US'
}

export function isDefaultLocale (locale: string) {
  return getCompleteLocale(locale) === getCompleteLocale(getDefaultLocale())
}

export function is18nPath (path: string) {
  return possiblePaths.indexOf(path) !== -1
}

export function is18nLocale (locale: string) {
  return POSSIBLE_LOCALES.indexOf(locale) !== -1
}

export function getCompleteLocale (locale: string) {
  if (!locale) return locale

  if (I18N_LOCALE_ALIAS[locale]) return I18N_LOCALE_ALIAS[locale]

  return locale
}

export function getShortLocale (locale: string) {
  if (locale.indexOf('-') === -1) return locale

  return locale.split('-')[0]
}

export function buildFileLocale (locale: string) {
  const completeLocale = getCompleteLocale(locale)

  return completeLocale.replace('-', '_')
}
