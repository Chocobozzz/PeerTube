import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestService } from '@app/shared'
import { environment } from '../../../../environments/environment'

@Injectable()
export class RedundancyService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/server/redundancy'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  updateRedundancy (host: string, redundancyAllowed: boolean) {
    const url = RedundancyService.BASE_USER_SUBSCRIPTIONS_URL + '/' + host

    const body = { redundancyAllowed }

    return this.authHttp.put(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

}
