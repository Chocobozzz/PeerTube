import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { RestExtractor } from '../../shared/rest';

@Injectable()
export class ConfigService {
  private static BASE_CONFIG_URL = API_URL + '/api/v1/config/';

  private config: {
    signup: {
      enabled: boolean
    }
  } = {
    signup: {
      enabled: false
    }
  };

  constructor(
    private http: Http,
    private restExtractor: RestExtractor,
  ) {}

  loadConfig() {
    this.http.get(ConfigService.BASE_CONFIG_URL)
             .map(this.restExtractor.extractDataGet)
             .subscribe(data => {
               this.config = data;
             });
  }

  getConfig() {
    return this.config;
  }
}
