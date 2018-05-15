import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { CustomConfig } from '../../../../../../shared/models/server/custom-config.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared'

@Injectable()
export class ConfigService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/config'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getCustomConfig () {
    return this.authHttp.get<CustomConfig>(ConfigService.BASE_APPLICATION_URL + '/custom')
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateCustomConfig (data: CustomConfig) {
    return this.authHttp.put<CustomConfig>(ConfigService.BASE_APPLICATION_URL + '/custom', data)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
