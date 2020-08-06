import { Observable, of, Subject } from 'rxjs'
import { first, map, share, shareReplay, switchMap, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Inject, Injectable, LOCALE_ID } from '@angular/core'
import { getDevLocale, isOnDevLocale, sortBy } from '@app/helpers'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { getCompleteLocale, isDefaultLocale, peertubeTranslate } from '@shared/core-utils/i18n'
import { SearchTargetType, ServerConfig, ServerStats, VideoConstant } from '@shared/models'
import { environment } from '../../../environments/environment'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'
  private static BASE_LOCALE_URL = environment.apiUrl + '/client/locales/'
  private static BASE_STATS_URL = environment.apiUrl + '/api/v1/server/stats'

  private static CONFIG_LOCAL_STORAGE_KEY = 'server-config'

  configReloaded = new Subject<ServerConfig>()

  private localeObservable: Observable<any>
  private videoLicensesObservable: Observable<VideoConstant<number>[]>
  private videoCategoriesObservable: Observable<VideoConstant<number>[]>
  private videoPrivaciesObservable: Observable<VideoConstant<number>[]>
  private videoPlaylistPrivaciesObservable: Observable<VideoConstant<number>[]>
  private videoLanguagesObservable: Observable<VideoConstant<string>[]>
  private configObservable: Observable<ServerConfig>

  private configReset = false

  private configLoaded = false
  private config: ServerConfig = {
    instance: {
      name: 'PeerTube',
      shortDescription: 'PeerTube, a federated (ActivityPub) video streaming platform  ' +
                        'using P2P (BitTorrent) directly in the web browser with WebTorrent and Angular.',
      defaultClientRoute: '',
      isNSFW: false,
      defaultNSFWPolicy: 'do_not_list' as 'do_not_list',
      customizations: {
        javascript: '',
        css: ''
      }
    },
    plugin: {
      registered: [],
      registeredExternalAuths: [],
      registeredIdAndPassAuths: []
    },
    theme: {
      registered: [],
      default: 'default'
    },
    email: {
      enabled: false
    },
    contactForm: {
      enabled: false
    },
    serverVersion: 'Unknown',
    signup: {
      allowed: false,
      allowedForCurrentIP: false,
      requiresEmailVerification: false
    },
    transcoding: {
      enabledResolutions: [],
      hls: {
        enabled: false
      },
      webtorrent: {
        enabled: true
      }
    },
    avatar: {
      file: {
        size: { max: 0 },
        extensions: []
      }
    },
    video: {
      image: {
        size: { max: 0 },
        extensions: []
      },
      file: {
        extensions: []
      }
    },
    videoCaption: {
      file: {
        size: { max: 0 },
        extensions: []
      }
    },
    user: {
      videoQuota: -1,
      videoQuotaDaily: -1
    },
    import: {
      videos: {
        http: {
          enabled: false
        },
        torrent: {
          enabled: false
        }
      }
    },
    trending: {
      videos: {
        intervalDays: 0
      }
    },
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: false
        }
      }
    },
    tracker: {
      enabled: true
    },
    followings: {
      instance: {
        autoFollowIndex: {
          indexUrl: 'https://instances.joinpeertube.org'
        }
      }
    },
    broadcastMessage: {
      enabled: false,
      message: '',
      level: 'info',
      dismissable: false
    },
    search: {
      remoteUri: {
        users: true,
        anonymous: false
      },
      searchIndex: {
        enabled: false,
        url: '',
        disableLocalSearch: false,
        isDefaultSearch: false
      }
    }
  }

  constructor (
    private http: HttpClient,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.loadConfigLocally()
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
    this.getConfig().subscribe(() => {
      // empty, to fire a reset config event
    })
  }

  getConfig () {
    if (this.configLoaded) return of(this.config)

    if (!this.configObservable) {
      this.configObservable = this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
                                  .pipe(
                                    tap(config => this.saveConfigLocally(config)),
                                    tap(config => {
                                      this.config = config
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

  getTmpConfig () {
    return this.config
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
      this.videoPrivaciesObservable = this.loadAttributeEnum<number>(ServerService.BASE_VIDEO_URL, 'privacies')
    }

    return this.videoPrivaciesObservable.pipe(first())
  }

  getVideoPlaylistPrivacies () {
    if (!this.videoPlaylistPrivaciesObservable) {
      this.videoPlaylistPrivaciesObservable = this.loadAttributeEnum<number>(ServerService.BASE_VIDEO_PLAYLIST_URL, 'privacies')
    }

    return this.videoPlaylistPrivaciesObservable.pipe(first())
  }

  getServerLocale () {
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

  getDefaultSearchTarget (): Promise<SearchTargetType> {
    return this.getConfig().pipe(
      map(config => {
        const searchIndexConfig = config.search.searchIndex

        if (searchIndexConfig.enabled && (searchIndexConfig.isDefaultSearch || searchIndexConfig.disableLocalSearch)) {
          return 'search-index'
        }

        return 'local'
      })
    ).toPromise()
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
                                                                      const label = data[ dataKey ]

                                                                      const id = attributeName === 'languages'
                                                                        ? dataKey as T
                                                                        : parseInt(dataKey, 10) as T

                                                                      return {
                                                                        id,
                                                                        label: peertubeTranslate(label, translations)
                                                                      }
                                                                    })

                   if (sort === true) sortBy(hashToPopulate, 'label')

                   return hashToPopulate
                 }),
                 shareReplay()
               )
  }

  private saveConfigLocally (config: ServerConfig) {
    peertubeLocalStorage.setItem(ServerService.CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config))
  }

  private loadConfigLocally () {
    const configString = peertubeLocalStorage.getItem(ServerService.CONFIG_LOCAL_STORAGE_KEY)

    if (configString) {
      try {
        const parsed = JSON.parse(configString)
        Object.assign(this.config, parsed)
      } catch (err) {
        console.error('Cannot parse config saved in local storage.', err)
      }
    }
  }
}
