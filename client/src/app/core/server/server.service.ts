import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import 'rxjs/add/operator/do'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { ServerConfig } from '../../../../../shared'
import { About } from '../../../../../shared/models/config/about.model'
import { environment } from '../../../environments/environment'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static CONFIG_LOCAL_STORAGE_KEY = 'server-config'

  videoPrivaciesLoaded = new ReplaySubject<boolean>(1)
  videoCategoriesLoaded = new ReplaySubject<boolean>(1)
  videoLicencesLoaded = new ReplaySubject<boolean>(1)
  videoLanguagesLoaded = new ReplaySubject<boolean>(1)

  private config: ServerConfig = {
    instance: {
      name: 'PeerTube'
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
      file: {
        extensions: []
      }
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
      .subscribe(data => this.config = data)
  }

  loadVideoCategories () {
    return this.loadVideoAttributeEnum('categories', this.videoCategories, this.videoCategoriesLoaded)
  }

  loadVideoLicences () {
    return this.loadVideoAttributeEnum('licences', this.videoLicences, this.videoLicencesLoaded)
  }

  loadVideoLanguages () {
    return this.loadVideoAttributeEnum('languages', this.videoLanguages, this.videoLanguagesLoaded)
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
    notifier: ReplaySubject<boolean>
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

         notifier.next(true)
       })
  }

  private saveConfigLocally (config: ServerConfig) {
    localStorage.setItem(ServerService.CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config))
  }

  private loadConfigLocally () {
    const configString = localStorage.getItem(ServerService.CONFIG_LOCAL_STORAGE_KEY)

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
