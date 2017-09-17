import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { RestExtractor } from '../../../shared'
import { BlacklistedVideo, ResultList } from '../../../../../../shared'

@Injectable()
export class BlacklistService {
  private static BASE_BLACKLISTS_URL = '/api/v1/blacklist/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getBlacklist () {
    return this.authHttp.get<ResultList<BlacklistedVideo>>(BlacklistService.BASE_BLACKLISTS_URL)
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  removeVideoFromBlacklist (entry: BlacklistedVideo) {
    return this.authHttp.delete(BlacklistService.BASE_BLACKLISTS_URL + entry.id)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }
}
