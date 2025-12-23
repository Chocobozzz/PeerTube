import { SortMeta } from 'primeng/api'
import { from } from 'rxjs'
import { catchError, concatMap, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { arrayify } from '@peertube/peertube-core-utils'
import { ResultList, UserRegistration, UserRegistrationUpdateState } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class AdminRegistrationService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  private static BASE_REGISTRATION_URL = environment.apiUrl + '/api/v1/users/registrations'

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

  acceptRegistration (options: {
    registration: UserRegistration
    moderationResponse: string
    preventEmailDelivery: boolean
  }) {
    const { registration, moderationResponse, preventEmailDelivery } = options

    const url = AdminRegistrationService.BASE_REGISTRATION_URL + '/' + registration.id + '/accept'
    const body: UserRegistrationUpdateState = { moderationResponse, preventEmailDelivery }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  rejectRegistration (options: {
    registration: UserRegistration
    moderationResponse: string
    preventEmailDelivery: boolean
  }) {
    const { registration, moderationResponse, preventEmailDelivery } = options

    const url = AdminRegistrationService.BASE_REGISTRATION_URL + '/' + registration.id + '/reject'
    const body: UserRegistrationUpdateState = { moderationResponse, preventEmailDelivery }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  removeRegistrations (registrationsArg: UserRegistration | UserRegistration[]) {
    const registrations = arrayify(registrationsArg)

    return from(registrations)
      .pipe(
        concatMap(r => this.authHttp.delete(AdminRegistrationService.BASE_REGISTRATION_URL + '/' + r.id)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
