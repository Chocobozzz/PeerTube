import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import 'rxjs/add/operator/do'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { ServerConfig } from '../../../../../shared'
import { About } from '../../../../../shared/models/server/about.model'
import { ServerStats } from '../../../../../shared/models/server/server-stats.model'
import { environment } from '../../../environments/environment'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static CONFIG_LOCAL_STORAGE_KEY = 'server-config'

  configLoaded = new ReplaySubject<boolean>(1)
  videoPrivaciesLoaded = new ReplaySubject<boolean>(1)
  videoCategoriesLoaded = new ReplaySubject<boolean>(1)
  videoLicencesLoaded = new ReplaySubject<boolean>(1)
  videoLanguagesLoaded = new ReplaySubject<boolean>(1)

  private config: ServerConfig = {
    instance: {
      name: 'PeerTube',
      shortDescription: 'PeerTube, a federated (ActivityPub) video streaming platform  ' +
                        'using P2P (BitTorrent) directly in the web browser with WebTorrent and Angular.',
      defaultClientRoute: '',
      customizations: {
        javascript: '',
        css: ''
      }
    },
    serverVersion: 'Unknown',
    signup: {
      allowed: false
    },
    transcoding: {
      enabledResolutions: []
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
    user: {
      videoQuota: -1
    }
  }
  private videoCategories: Array<{ id: number, label: string }> = []
  private videoLicences: Array<{ id: number, label: string }> = []
  private videoLanguages: Array<{ id: number, label: string }> = []
  private videoPrivacies: Array<{ id: number, label: string }> = []

  constructor (private http: HttpClient) {
    this.loadConfigLocally()
  }

  loadConfig () {
    this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
      .do(this.saveConfigLocally)
      .subscribe(data => {
        this.config = data

        this.configLoaded.next(true)
      })
  }

  loadVideoCategories () {
    return this.loadVideoAttributeEnum('categories', this.videoCategories, this.videoCategoriesLoaded, true)
  }

  loadVideoLicences () {
    return this.loadVideoAttributeEnum('licences', this.videoLicences, this.videoLicencesLoaded)
  }

  loadVideoLanguages () {
    return this.loadVideoAttributeEnum('languages', this.videoLanguages, this.videoLanguagesLoaded, true)
  }

  loadVideoPrivacies () {
    return this.loadVideoAttributeEnum('privacies', this.videoPrivacies, this.videoPrivaciesLoaded)
  }

  getConfig () {
    return this.config
  }

  getVideoCategories () {
    return this.videoCategories
  }

  getVideoLicences () {
    return this.videoLicences
  }

  getVideoLanguages () {
    return this.videoLanguages
  }

  getVideoPrivacies () {
    return this.videoPrivacies
  }

  getAbout () {
    return this.http.get<About>(ServerService.BASE_CONFIG_URL + '/about')
  }

  private loadVideoAttributeEnum (
    attributeName: 'categories' | 'licences' | 'languages' | 'privacies',
    hashToPopulate: { id: number, label: string }[],
    notifier: ReplaySubject<boolean>,
    sort = false
  ) {
    return this.http.get(ServerService.BASE_VIDEO_URL + attributeName)
       .subscribe(data => {
         Object.keys(data)
               .forEach(dataKey => {
                 hashToPopulate.push({
                   id: parseInt(dataKey, 10),
                   label: data[dataKey]
                 })
               })

         if (sort === true) {
           hashToPopulate.sort((a, b) => {
             if (a.label < b.label) return -1
             if (a.label === b.label) return 0
             return 1
           })
         }

         notifier.next(true)
       })
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
