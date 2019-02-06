import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { About } from '../../../../../shared/models/server'

@Injectable()
export class InstanceService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config'
  private static BASE_SERVER_URL = environment.apiUrl + '/api/v1/server'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {
  }

  getAbout () {
    return this.authHttp.get<About>(InstanceService.BASE_CONFIG_URL + '/about')
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  contactAdministrator (fromEmail: string, fromName: string, message: string) {
    const body = {
      fromEmail,
      fromName,
      body: message
    }

    return this.authHttp.post(InstanceService.BASE_SERVER_URL + '/contact', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))

  }
}
