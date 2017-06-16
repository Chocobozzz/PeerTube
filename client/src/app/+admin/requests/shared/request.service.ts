import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { RequestStats } from './request-stats.model'
import { AuthHttp, RestExtractor } from '../../../shared'

@Injectable()
export class RequestService {
  private static BASE_REQUEST_URL = API_URL + '/api/v1/requests/'

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getStats (): Observable<{ [ id: string ]: RequestStats }> {
    return this.authHttp.get(RequestService.BASE_REQUEST_URL + 'stats')
                        .map(this.restExtractor.extractDataGet)
                        .map(this.buildRequestObjects)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  private buildRequestObjects (data: any) {
    const requestSchedulers = {}

    Object.keys(data).forEach(requestSchedulerName => {
      requestSchedulers[requestSchedulerName] = new RequestStats(data[requestSchedulerName])
    })

    return requestSchedulers
  }
}
