import { Injectable } from '@angular/core';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { AuthHttp, RestExtractor, RestDataSource, User } from '../../../shared';

@Injectable()
export class UserService {
  // TODO: merge this constant with account
  private static BASE_USERS_URL = '/api/v1/users/';

  constructor(
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  addUser(username: string, password: string) {
    const body = {
      username,
      password
    };

    return this.authHttp.post(UserService.BASE_USERS_URL, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError);
  }

  getDataSource() {
    return new RestDataSource(this.authHttp, UserService.BASE_USERS_URL);
  }

  removeUser(user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id);
  }
}
