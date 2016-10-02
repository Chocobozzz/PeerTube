import { Injectable } from '@angular/core';

import { AuthHttp, RestExtractor, ResultList, User } from '../../../shared';

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

  getUsers() {
    return this.authHttp.get(UserService.BASE_USERS_URL)
                 .map(this.restExtractor.extractDataList)
                 .map(this.extractUsers)
                 .catch((res) => this.restExtractor.handleError(res));
  }

  removeUser(user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id);
  }

  private extractUsers(result: ResultList) {
    const usersJson = result.data;
    const totalUsers = result.total;
    const users = [];
    for (const userJson of usersJson) {
      users.push(new User(userJson));
    }

    return { users, totalUsers };
  }
}
