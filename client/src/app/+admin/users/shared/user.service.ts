import { Injectable } from '@angular/core'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe'

import { AuthHttp, RestExtractor, RestDataSource, User } from '../../../shared'
import { UserCreate } from '../../../../../../shared'

@Injectable()
export class UserService {
  private static BASE_USERS_URL = API_URL + '/api/v1/users/'
  private bytesPipe = new BytesPipe()

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  addUser (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL, userCreate)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError)
  }

  getDataSource () {
    return new RestDataSource(this.authHttp, UserService.BASE_USERS_URL, this.formatDataSource.bind(this))
  }

  removeUser (user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id)
  }

  private formatDataSource (users: User[]) {
    const newUsers = []

    users.forEach(user => {
      let videoQuota
      if (user.videoQuota === -1) {
        videoQuota = 'Unlimited'
      } else {
        videoQuota = this.bytesPipe.transform(user.videoQuota)
      }

      const newUser = Object.assign(user, {
        videoQuota
      })
      newUsers.push(newUser)
    })

    return newUsers
  }
}
