import { Injectable } from '@angular/core';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { AuthService } from '../../core';
import { AuthHttp } from '../auth';
import { RestExtractor } from '../rest';

@Injectable()
export class UserService {
  private static BASE_USERS_URL = '/api/v1/users/';

  constructor(
    private authHttp: AuthHttp,
    private authService: AuthService,
    private restExtractor: RestExtractor
  ) {}

  checkTokenValidity() {
    const url = UserService.BASE_USERS_URL + 'me';

    // AuthHttp will redirect us to the login page if the oken is not valid anymore
    this.authHttp.get(url).subscribe(() => { ; });
  }

  changePassword(newPassword: string) {
    const url = UserService.BASE_USERS_URL + this.authService.getUser().id;
    const body = {
      password: newPassword
    };

    return this.authHttp.put(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res));
  }
}
