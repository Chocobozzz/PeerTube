import { Injectable } from '@angular/core';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { AuthHttp, RestExtractor, RestDataSource, User } from '../../../shared';

@Injectable()
export class UserService {
  private static BASE_USERS_URL = API_URL + '/api/v1/users/';

  constructor(
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  addUser(username: string, password: string, email: string) {
    const body = {
      username,
      email,
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
