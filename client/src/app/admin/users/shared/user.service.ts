import { Injectable } from '@angular/core';
import { Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { AuthHttp, User } from '../../../shared';

@Injectable()
export class UserService {
  // TODO: merge this constant with account
  private static BASE_USERS_URL = '/api/v1/users/';

  constructor(private authHttp: AuthHttp) {}

  addUser(username: string, password: string) {
    const body = {
      username,
      password
    };

    return this.authHttp.post(UserService.BASE_USERS_URL, body);
  }

  getUsers() {
    return this.authHttp.get(UserService.BASE_USERS_URL)
                 .map(res => res.json())
                 .map(this.extractUsers)
                 .catch(this.handleError);
  }

  removeUser(user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id);
  }

  private extractUsers(body: any) {
    const usersJson = body.data;
    const totalUsers = body.total;
    const users = [];
    for (const userJson of usersJson) {
      users.push(new User(userJson));
    }

    return { users, totalUsers };
  }

  private handleError(error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
