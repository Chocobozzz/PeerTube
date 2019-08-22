export const LOCALE_FILES = [ 'player', 'server' ]

export const I18N_LOCALES = {
  'en-US': 'English',
  'fr-FR': 'Français',
  'ja-JP': '日本語',
  'eu-ES': 'Euskara',
  'ca-ES': 'Català',
  'cs-CZ': 'Čeština',
  'eo': 'Esperanto',
  'el-GR': 'ελληνικά',
  'de-DE': 'Deutsch',
  'it-IT': 'Italiano',
  'nl-NL': 'Nederlands',
  'es-ES': 'Español',
  'oc': 'Occitan',
  'gd': 'Gàidhlig',
  'zh-Hant-TW': '繁體中文（台灣）',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'sv-SE': 'svenska',
  'pl-PL': 'Polski',
  'fi-FI': 'suomi',
  'ru-RU': 'русский',
  'zh-Hans-CN': '简体中文（中国）'
}

const I18N_LOCALE_ALIAS = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'eu': 'eu-ES',
  'ca': 'ca-ES',
  'cs': 'cs-CZ',
  'de': 'de-DE',
  'es': 'es-ES',
  'pt': 'pt-PT',
  'fi': 'fi-FI',
  'sv': 'sv-SE',
  'pl': 'pl-PL',
  'ru': 'ru-RU',
  'nl': 'nl-NL',
  'zh': 'zh-Hans-CN'
}

export const POSSIBLE_LOCALES = Object.keys(I18N_LOCALES)
                                      .concat(Object.keys(I18N_LOCALE_ALIAS))

export function getDefaultLocale () {
  return 'en-US'
}

export function isDefaultLocale (locale: string) {
  return getCompleteLocale(locale) === getCompleteLocale(getDefaultLocale())
}

export function peertubeTranslate (str: string, translations?: { [ id: string ]: string }) {
  return translations && translations[str] ? translations[str] : str
}

const possiblePaths = POSSIBLE_LOCALES.map(l => '/' + l)
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

  return completeLocale.replace(/-/g, '_')
}
