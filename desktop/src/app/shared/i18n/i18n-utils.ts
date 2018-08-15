import { environment } from '../../../environments/environment'

function peertubeTranslate (str: string, translations: { [ id: string ]: string }) {
  return translations[str] ? translations[str] : str
}

function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

function getDevLocale () {
  return 'fr'
}

export {
  getDevLocale,
  isOnDevLocale,
  peertubeTranslate
}
