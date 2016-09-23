import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { RequestStats } from './request-stats.model';
import { AuthHttp, RestExtractor } from '../../../shared';

@Injectable()
export class RequestService {
  private static BASE_REQUEST_URL: string = '/api/v1/requests/';

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getStats(): Observable<RequestStats> {
    return this.authHttp.get(RequestService.BASE_REQUEST_URL + 'stats')
                        .map(this.restExtractor.extractDataGet)
                        .map((data) => new RequestStats(data))
                        .catch((res) => this.restExtractor.handleError(res));
  }
}
