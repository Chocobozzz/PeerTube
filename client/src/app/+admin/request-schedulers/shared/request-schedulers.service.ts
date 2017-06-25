import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { RequestSchedulerStats } from '../../../../../../shared'
import { AuthHttp, RestExtractor } from '../../../shared'
import { RequestSchedulerStatsAttributes } from './request-schedulers-stats-attributes.model'

@Injectable()
export class RequestSchedulersService {
  private static BASE_REQUEST_URL = API_URL + '/api/v1/request-schedulers/'

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getStats (): Observable<RequestSchedulerStats> {
    return this.authHttp.get(RequestSchedulersService.BASE_REQUEST_URL + 'stats')
                        .map(this.restExtractor.extractDataGet)
                        .map(this.buildRequestObjects)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  private buildRequestObjects (data: RequestSchedulerStats) {
    const requestSchedulers = {}

    Object.keys(data).forEach(requestSchedulerName => {
      requestSchedulers[requestSchedulerName] = new RequestSchedulerStatsAttributes(data[requestSchedulerName])
    })

    return requestSchedulers
  }
}
