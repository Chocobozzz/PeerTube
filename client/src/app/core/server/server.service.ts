import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'

import { ServerConfig } from '../../../../../shared'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = API_URL + '/api/v1/config/'
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  private config: ServerConfig = {
    signup: {
      allowed: false
    }
  }
  private videoCategories: Array<{ id: number, label: string }> = []
  private videoLicences: Array<{ id: number, label: string }> = []
  private videoLanguages: Array<{ id: number, label: string }> = []

  constructor (private http: HttpClient) {}

  loadConfig () {
    this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
             .subscribe(data => this.config = data)
  }

  loadVideoCategories () {
    return this.loadVideoAttributeEnum('categories', this.videoCategories)
  }

  loadVideoLicences () {
    return this.loadVideoAttributeEnum('licences', this.videoLicences)
  }

  loadVideoLanguages () {
    return this.loadVideoAttributeEnum('languages', this.videoLanguages)
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

  private loadVideoAttributeEnum (attributeName: 'categories' | 'licences' | 'languages', hashToPopulate: { id: number, label: string }[]) {
    return this.http.get(ServerService.BASE_VIDEO_URL + attributeName)
               .subscribe(data => {
                 Object.keys(data)
                       .forEach(dataKey => {
                         hashToPopulate.push({
                           id: parseInt(dataKey, 10),
                           label: data[dataKey]
                         })
                       })
               })
  }
}
