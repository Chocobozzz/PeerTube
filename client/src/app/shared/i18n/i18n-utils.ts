import { environment } from '../../../environments/environment'

function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

function getDevLocale () {
  return 'fr'
}

export {
  getDevLocale,
  isOnDevLocale
}
