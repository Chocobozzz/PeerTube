import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'

import { ServerConfig } from '../../../../../shared'

@Injectable()
export class ConfigService {
  private static BASE_CONFIG_URL = API_URL + '/api/v1/config/'

  private config: ServerConfig = {
    signup: {
      allowed: false
    }
  }

  constructor (private http: HttpClient) {}

  loadConfig () {
    this.http.get<ServerConfig>(ConfigService.BASE_CONFIG_URL)
             .subscribe(data => this.config = data)
  }

  getConfig () {
    return this.config
  }
}
