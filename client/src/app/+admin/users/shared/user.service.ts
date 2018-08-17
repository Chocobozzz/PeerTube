import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { BytesPipe } from 'ngx-pipes'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { Observable } from 'rxjs'
import { ResultList, UserCreate, UserUpdate, User } from '../../../../../../shared'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Injectable()
export class UserService {
  private static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'
  private bytesPipe = new BytesPipe()

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor,
    private i18n: I18n
  ) { }

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

  banUser (user: User, reason?: string) {
    const body = reason ? { reason } : {}

    return this.authHttp.post(UserService.BASE_USERS_URL + user.id + '/block', body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  unbanUser (user: User) {
    return this.authHttp.post(UserService.BASE_USERS_URL + user.id + '/unblock', {})
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private formatUser (user: User) {
    let videoQuota
    if (user.videoQuota === -1) {
      videoQuota = this.i18n('Unlimited')
    } else {
      videoQuota = this.bytesPipe.transform(user.videoQuota, 0)
    }

    const videoQuotaUsed = this.bytesPipe.transform(user.videoQuotaUsed, 0)

    return Object.assign(user, {
      videoQuota,
      videoQuotaUsed
    })
  }
}
