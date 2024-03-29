import { Observable, of, Subject } from 'rxjs'
import { first, map, share, shareReplay, switchMap, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Inject, Injectable, LOCALE_ID } from '@angular/core'
import { getDevLocale, isOnDevLocale } from '@app/helpers'
import { getCompleteLocale, isDefaultLocale, peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  HTMLServerConfig,
  ServerConfig,
  ServerStats,
  VideoCommentPolicy,
  VideoConstant,
  VideoPlaylistPrivacyType,
  VideoPrivacyType
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { environment } from '../../../environments/environment'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'
  private static BASE_LOCALE_URL = environment.apiUrl + '/client/locales/'
  private static BASE_STATS_URL = environment.apiUrl + '/api/v1/server/stats'

  configReloaded = new Subject<ServerConfig>()

  private localeObservable: Observable<any>
  private videoLicensesObservable: Observable<VideoConstant<number>[]>
  private videoCategoriesObservable: Observable<VideoConstant<number>[]>
  private videoPrivaciesObservable: Observable<VideoConstant<VideoPrivacyType>[]>
  private videoPlaylistPrivaciesObservable: Observable<VideoConstant<VideoPlaylistPrivacyType>[]>
  private videoLanguagesObservable: Observable<VideoConstant<string>[]>
  private configObservable: Observable<ServerConfig>

  private configReset = false

  private configLoaded = false
  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  constructor (
    private http: HttpClient,
    @Inject(LOCALE_ID) private localeId: string
  ) {
  }

  loadHTMLConfig () {
    try {
      this.loadHTMLConfigLocally()
    } catch (err) {
      // Expected in dev mode since we can't inject the config in the HTML
      if (environment.production !== false) {
        logger.error('Cannot load config locally. Fallback to API.')
      }

      return this.getConfig()
    }
  }

  getServerVersionAndCommit () {
    const serverVersion = this.config.serverVersion
    const commit = this.config.serverCommit || ''

    let result = serverVersion
    if (commit) result += '...' + commit

    return result
  }

  resetConfig () {
    this.configLoaded = false
    this.configReset = true

    // Notify config update
    return this.getConfig()
  }

  getConfig () {
    if (this.configLoaded) return of(this.config)

    if (!this.configObservable) {
      this.configObservable = this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
                                  .pipe(
                                    tap(config => {
                                      this.config = config
                                      this.htmlConfig = config
                                      this.configLoaded = true
                                    }),
                                    tap(config => {
                                      if (this.configReset) {
                                        this.configReloaded.next(config)
                                        this.configReset = false
                                      }
                                    }),
                                    share()
                                  )
    }

    return this.configObservable
  }

  getHTMLConfig () {
    return this.htmlConfig
  }

  getCommentPolicies () {
    return of([
      {
        id: VideoCommentPolicy.DISABLED,
        label: $localize`Comments are disabled`
      },
      {
        id: VideoCommentPolicy.ENABLED,
        label: $localize`Comments are enabled`,
        description: $localize`Comments may require approval depending on your auto tag policies`
      },
      {
        id: VideoCommentPolicy.REQUIRES_APPROVAL,
        label: $localize`Any new comment requires approval`
      }
    ])
  }

  getVideoCategories () {
    if (!this.videoCategoriesObservable) {
      this.videoCategoriesObservable = this.loadAttributeEnum<number>(ServerService.BASE_VIDEO_URL, 'categories', true)
    }

    return this.videoCategoriesObservable.pipe(first())
  }

  getVideoLicences () {
    if (!this.videoLicensesObservable) {
      this.videoLicensesObservable = this.loadAttributeEnum<number>(ServerService.BASE_VIDEO_URL, 'licences')
    }

    return this.videoLicensesObservable.pipe(first())
  }

  getVideoLanguages () {
    if (!this.videoLanguagesObservable) {
      this.videoLanguagesObservable = this.loadAttributeEnum<string>(ServerService.BASE_VIDEO_URL, 'languages', true)
    }

    return this.videoLanguagesObservable.pipe(first())
  }

  getVideoPrivacies () {
    if (!this.videoPrivaciesObservable) {
      this.videoPrivaciesObservable = this.loadAttributeEnum<VideoPrivacyType>(ServerService.BASE_VIDEO_URL, 'privacies')
    }

    return this.videoPrivaciesObservable.pipe(first())
  }

  getVideoPlaylistPrivacies () {
    if (!this.videoPlaylistPrivaciesObservable) {
      this.videoPlaylistPrivaciesObservable = this.loadAttributeEnum<VideoPlaylistPrivacyType>(
        ServerService.BASE_VIDEO_PLAYLIST_URL,
        'privacies'
      )
    }

    return this.videoPlaylistPrivaciesObservable.pipe(first())
  }

  getServerLocale (): Observable<{ [ id: string ]: string }> {
    if (!this.localeObservable) {
      const completeLocale = isOnDevLocale() ? getDevLocale() : getCompleteLocale(this.localeId)

      // Default locale, nothing to translate
      if (isDefaultLocale(completeLocale)) {
        this.localeObservable = of({}).pipe(shareReplay())
      } else {
        this.localeObservable = this.http
                                    .get(ServerService.BASE_LOCALE_URL + completeLocale + '/server.json')
                                    .pipe(shareReplay())
      }
    }

    return this.localeObservable.pipe(first())
  }

  getServerStats () {
    return this.http.get<ServerStats>(ServerService.BASE_STATS_URL)
  }

  private loadAttributeEnum <T extends string | number> (
    baseUrl: string,
    attributeName: 'categories' | 'licences' | 'languages' | 'privacies',
    sort = false
  ) {
    return this.getServerLocale()
               .pipe(
                 switchMap(translations => {
                   return this.http.get<{ [ id: string ]: string }>(baseUrl + attributeName)
                              .pipe(map(data => ({ data, translations })))
                 }),
                 map(({ data, translations }) => {
                   const hashToPopulate: VideoConstant<T>[] = Object.keys(data)
                                                                    .map(dataKey => {
                                                                      const label = data[dataKey]

                                                                      const id = attributeName === 'languages'
                                                                        ? dataKey as T
                                                                        : parseInt(dataKey, 10) as T

                                                                      return {
                                                                        id,
                                                                        label: peertubeTranslate(label, translations)
                                                                      }
                                                                    })

                   if (sort === true) {
                     hashToPopulate.sort((a, b) => a.label.localeCompare(b.label))
                   }

                   return hashToPopulate
                 }),
                 shareReplay()
               )
  }

  private loadHTMLConfigLocally () {
    const configString = (window as any)['PeerTubeServerConfig']
    if (!configString) {
      throw new Error('Could not find PeerTubeServerConfig in HTML')
    }

    this.htmlConfig = JSON.parse(configString)
  }
}
