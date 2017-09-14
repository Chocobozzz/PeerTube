import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { RestExtractor } from '../rest'
import { UserCreate, UserUpdateMe } from '../../../../../shared'

@Injectable()
export class UserService {
  static BASE_USERS_URL = API_URL + '/api/v1/users/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  checkTokenValidity () {
    const url = UserService.BASE_USERS_URL + 'me'

    // AuthHttp will redirect us to the login page if the token is not valid anymore
    this.authHttp.get(url).subscribe()
  }

  changePassword (newPassword: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      password: newPassword
    }

    return this.authHttp.put(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  updateMyDetails (details: UserUpdateMe) {
    const url = UserService.BASE_USERS_URL + 'me'

    return this.authHttp.put(url, details)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  signup (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL + 'register', userCreate)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }
}
