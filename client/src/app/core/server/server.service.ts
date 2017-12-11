import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import 'rxjs/add/operator/do'
import { ReplaySubject } from 'rxjs/ReplaySubject'

import { ServerConfig } from '../../../../../shared'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = API_URL + '/api/v1/config/'
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  videoPrivaciesLoaded = new ReplaySubject<boolean>(1)
  videoCategoriesLoaded = new ReplaySubject<boolean>(1)
  videoLicencesLoaded = new ReplaySubject<boolean>(1)
  videoLanguagesLoaded = new ReplaySubject<boolean>(1)

  private config: ServerConfig = {
    signup: {
      allowed: false
    },
    transcoding: {
      enabledResolutions: []
    }
  }
  private videoCategories: Array<{ id: number, label: string }> = []
  private videoLicences: Array<{ id: number, label: string }> = []
  private videoLanguages: Array<{ id: number, label: string }> = []
  private videoPrivacies: Array<{ id: number, label: string }> = []

  constructor (private http: HttpClient) {}

  loadConfig () {
    this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
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
}
