import { getCompleteLocale, getShortLocale, is18nLocale, isDefaultLocale } from '@peertube/peertube-core-utils'
import { logger } from '@root-helpers/logger'

export class TranslationsManager {
  private static videojsLocaleCache: { [ path: string ]: any } = {}

  static getServerTranslations (serverUrl: string, locale: string): Promise<{ [id: string]: string }> {
    const path = TranslationsManager.getLocalePath(serverUrl, locale)
    // It is the default locale, nothing to translate
    if (!path) return Promise.resolve(undefined)

    return fetch(path + '/server.json')
      .then(res => res.json())
      .catch(err => {
        logger.error('Cannot get server translations', err)

        return undefined as any
      })
  }

  static loadLocaleInVideoJS (serverUrl: string, locale: string, videojs: any) {
    const path = TranslationsManager.getLocalePath(serverUrl, locale)
    // It is the default locale, nothing to translate
    if (!path) return Promise.resolve(undefined)

    let p: Promise<any>

    if (TranslationsManager.videojsLocaleCache[path]) {
      p = Promise.resolve(TranslationsManager.videojsLocaleCache[path])
    } else {
      p = fetch(path + '/player.json')
        .then(res => res.json())
        .then(json => {
          TranslationsManager.videojsLocaleCache[path] = json
          return json
        })
        .catch(err => {
          logger.error('Cannot get player translations', err)

          return undefined as any
        })
    }

    const completeLocale = getCompleteLocale(locale)
    return p.then(json => videojs.addLanguage(getShortLocale(completeLocale), json))
  }

  private static getLocalePath (serverUrl: string, locale: string) {
    const completeLocale = getCompleteLocale(locale)

    if (!is18nLocale(completeLocale) || isDefaultLocale(completeLocale)) return undefined

    return serverUrl + '/client/locales/' + completeLocale
  }
}
