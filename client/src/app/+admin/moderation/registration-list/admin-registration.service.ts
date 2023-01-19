import { SortMeta } from 'primeng/api'
import { catchError } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, UserRegistration } from '@shared/models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class AdminRegistrationService {
  private static BASE_REGISTRATION_URL = environment.apiUrl + '/api/v1/users/registrations'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  listRegistrations (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
  }) {
    const { pagination, sort, search } = options

    const url = AdminRegistrationService.BASE_REGISTRATION_URL

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = params.append('search', search)
    }

    return this.authHttp.get<ResultList<UserRegistration>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  acceptRegistration (registration: UserRegistration, moderationResponse: string) {
    const url = AdminRegistrationService.BASE_REGISTRATION_URL + '/' + registration.id + '/accept'
    const body = { moderationResponse }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  rejectRegistration (registration: UserRegistration, moderationResponse: string) {
    const url = AdminRegistrationService.BASE_REGISTRATION_URL + '/' + registration.id + '/reject'
    const body = { moderationResponse }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  removeRegistration (registration: UserRegistration) {
    const url = AdminRegistrationService.BASE_REGISTRATION_URL + '/' + registration.id

    return this.authHttp.delete(url)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
