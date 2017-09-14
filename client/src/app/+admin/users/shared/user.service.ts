import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { SortMeta } from 'primeng/components/common/sortmeta'
import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe'

import { RestExtractor, User, RestPagination, RestService } from '../../../shared'
import { UserCreate, UserUpdate, ResultList } from '../../../../../../shared'

@Injectable()
export class UserService {
  private static BASE_USERS_URL = API_URL + '/api/v1/users/'
  private bytesPipe = new BytesPipe()

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  addUser (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL, userCreate)
                        .map(this.restExtractor.extractDataBool)
                        .catch(err => this.restExtractor.handleError(err))
  }

  updateUser (userId: number, userUpdate: UserUpdate) {
    return this.authHttp.put(UserService.BASE_USERS_URL + userId, userUpdate)
                        .map(this.restExtractor.extractDataBool)
                        .catch(err => this.restExtractor.handleError(err))
  }

  getUser (userId: number) {
    return this.authHttp.get<User>(UserService.BASE_USERS_URL + userId)
                        .catch(err => this.restExtractor.handleError(err))
  }

  getUsers (pagination: RestPagination, sort: SortMeta): Observable<ResultList<User>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<User>>(UserService.BASE_USERS_URL, { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .map(res => this.restExtractor.applyToResultListData(res, this.formatUser.bind(this)))
                        .catch(err => this.restExtractor.handleError(err))
  }

  removeUser (user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id)
  }

  private formatUser (user: User) {
    let videoQuota
    if (user.videoQuota === -1) {
      videoQuota = 'Unlimited'
    } else {
      videoQuota = this.bytesPipe.transform(user.videoQuota)
    }

    return Object.assign(user, {
      videoQuota
    })
  }
}
