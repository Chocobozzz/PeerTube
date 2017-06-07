import { Injectable } from '@angular/core';

import { AuthHttp, RestDataSource, Blacklist } from '../../../shared';

@Injectable()
export class BlacklistService {
  private static BASE_BLACKLISTS_URL = '/api/v1/blacklists/';

  constructor(
    private authHttp: AuthHttp
  ) {}

  getDataSource() {
    return new RestDataSource(this.authHttp, BlacklistService.BASE_BLACKLISTS_URL);
  }

  removeVideoFromBlacklist(entry) {
    return this.authHttp.delete(BlacklistService.BASE_BLACKLISTS_URL + entry.videoId);
  }
}
