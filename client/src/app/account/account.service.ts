import { Injectable } from '@angular/core';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { AuthService } from '../core';
import { AuthHttp, RestExtractor } from '../shared';

@Injectable()
export class AccountService {
  private static BASE_USERS_URL = '/api/v1/users/';

  constructor(
    private authHttp: AuthHttp,
    private authService: AuthService,
    private restExtractor: RestExtractor
  ) {}

  changePassword(newPassword: string) {
    const url = AccountService.BASE_USERS_URL + this.authService.getUser().id;
    const body = {
      password: newPassword
    };

    return this.authHttp.put(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res));
  }
}
