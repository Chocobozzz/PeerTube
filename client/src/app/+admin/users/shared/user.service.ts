import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { BytesPipe } from 'ngx-pipes'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { Observable } from 'rxjs'
import { ResultList, UserCreate, UserUpdate } from '../../../../../../shared'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestPagination, RestService, User } from '../../../shared'

@Injectable()
export class UserService {
  private static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'
  private bytesPipe = new BytesPipe()

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {
  }

  addUser (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL, userCreate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateUser (userId: number, userUpdate: UserUpdate) {
    return this.authHttp.put(UserService.BASE_USERS_URL + userId, userUpdate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getUser (userId: number) {
    return this.authHttp.get<User>(UserService.BASE_USERS_URL + userId)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getUsers (pagination: RestPagination, sort: SortMeta): Observable<ResultList<User>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<User>>(UserService.BASE_USERS_URL, { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 map(res => this.restExtractor.applyToResultListData(res, this.formatUser.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeUser (user: User) {
    return this.authHttp.delete(UserService.BASE_USERS_URL + user.id)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
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
