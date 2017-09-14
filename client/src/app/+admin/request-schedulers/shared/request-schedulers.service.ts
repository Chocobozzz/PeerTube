import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { RequestSchedulerStats } from '../../../../../../shared'
import { RestExtractor } from '../../../shared'
import { RequestSchedulerStatsAttributes } from './request-schedulers-stats-attributes.model'

@Injectable()
export class RequestSchedulersService {
  private static BASE_REQUEST_URL = API_URL + '/api/v1/request-schedulers/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getStats () {
    return this.authHttp.get<RequestSchedulerStats>(RequestSchedulersService.BASE_REQUEST_URL + 'stats')
                        .map(res => this.buildRequestObjects(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  private buildRequestObjects (data: RequestSchedulerStats) {
    const requestSchedulers: { [ id: string ]: RequestSchedulerStatsAttributes } = {}

    Object.keys(data).forEach(requestSchedulerName => {
      requestSchedulers[requestSchedulerName] = new RequestSchedulerStatsAttributes(data[requestSchedulerName])
    })

    return requestSchedulers
  }
}
