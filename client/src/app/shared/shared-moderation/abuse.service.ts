import { omit } from 'lodash-es'
import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import {
  AbuseCreate,
  AbuseFilter,
  AbuseMessage,
  AbusePredefinedReasonsString,
  AbuseState,
  AbuseUpdate,
  AdminAbuse,
  ResultList,
  UserAbuse
} from '@shared/models'
import { environment } from '../../../environments/environment'

@Injectable()
export class AbuseService {
  private static BASE_ABUSE_URL = environment.apiUrl + '/api/v1/abuses'
  private static BASE_MY_ABUSE_URL = environment.apiUrl + '/api/v1/users/me/abuses'

  constructor (
    private i18n: I18n,
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) { }

  getAdminAbuses (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string
  }): Observable<ResultList<AdminAbuse>> {
    const { pagination, sort, search } = options
    const url = AbuseService.BASE_ABUSE_URL

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.buildParamsFromSearch(search, params)
    }

    return this.authHttp.get<ResultList<AdminAbuse>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  getUserAbuses (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string
  }): Observable<ResultList<UserAbuse>> {
    const { pagination, sort, search } = options
    const url = AbuseService.BASE_MY_ABUSE_URL

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.buildParamsFromSearch(search, params)
    }

    return this.authHttp.get<ResultList<UserAbuse>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  reportVideo (parameters: AbuseCreate) {
    const url = AbuseService.BASE_ABUSE_URL

    const body = omit(parameters, ['id'])

    return this.authHttp.post(url, body)
      .pipe(
        map(this.restExtractor.extractDataBool),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  updateAbuse (abuse: AdminAbuse, abuseUpdate: AbuseUpdate) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id

    return this.authHttp.put(url, abuseUpdate)
      .pipe(
        map(this.restExtractor.extractDataBool),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  removeAbuse (abuse: AdminAbuse) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id

    return this.authHttp.delete(url)
      .pipe(
        map(this.restExtractor.extractDataBool),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  addAbuseMessage (abuse: UserAbuse, message: string) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id + '/messages'

    return this.authHttp.post(url, { message })
    .pipe(
      map(this.restExtractor.extractDataBool),
      catchError(res => this.restExtractor.handleError(res))
    )
  }

  listAbuseMessages (abuse: UserAbuse) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id + '/messages'

    return this.authHttp.get<ResultList<AbuseMessage>>(url)
    .pipe(
      catchError(res => this.restExtractor.handleError(res))
    )
  }

  deleteAbuseMessage (abuse: UserAbuse, abuseMessage: AbuseMessage) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id + '/messages/' + abuseMessage.id

    return this.authHttp.delete(url)
    .pipe(
      map(this.restExtractor.extractDataBool),
      catchError(res => this.restExtractor.handleError(res))
    )
  }

  getPrefefinedReasons (type: AbuseFilter) {
    let reasons: { id: AbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = [
      {
        id: 'violentOrRepulsive',
        label: this.i18n('Violent or repulsive'),
        help: this.i18n('Contains offensive, violent, or coarse language or iconography.')
      },
      {
        id: 'hatefulOrAbusive',
        label: this.i18n('Hateful or abusive'),
        help: this.i18n('Contains abusive, racist or sexist language or iconography.')
      },
      {
        id: 'spamOrMisleading',
        label: this.i18n('Spam, ad or false news'),
        help: this.i18n('Contains marketing, spam, purposefully deceitful news, or otherwise misleading thumbnail/text/tags. Please provide reputable sources to report hoaxes.')
      },
      {
        id: 'privacy',
        label: this.i18n('Privacy breach or doxxing'),
        help: this.i18n('Contains personal information that could be used to track, identify, contact or impersonate someone (e.g. name, address, phone number, email, or credit card details).')
      },
      {
        id: 'rights',
        label: this.i18n('Copyright'),
        help: this.i18n('Infringes your copyright wrt. the regional laws with which the server must comply.')
      },
      {
        id: 'serverRules',
        label: this.i18n('Breaks server rules'),
        description: this.i18n('Anything not included in the above that breaks the terms of service, code of conduct, or general rules in place on the server.')
      }
    ]

    if (type === 'video') {
      reasons = reasons.concat([
        {
          id: 'thumbnails',
          label: this.i18n('Thumbnails'),
          help: this.i18n('The above can only be seen in thumbnails.')
        },
        {
          id: 'captions',
          label: this.i18n('Captions'),
          help: this.i18n('The above can only be seen in captions (please describe which).')
        }
      ])
    }

    return reasons
  }

  private buildParamsFromSearch (search: string, params: HttpParams) {
    const filters = this.restService.parseQueryStringFilter(search, {
      id: { prefix: '#' },
      state: {
        prefix: 'state:',
        handler: v => {
          if (v === 'accepted') return AbuseState.ACCEPTED
          if (v === 'pending') return AbuseState.PENDING
          if (v === 'rejected') return AbuseState.REJECTED

          return undefined
        }
      },
      videoIs: {
        prefix: 'videoIs:',
        handler: v => {
          if (v === 'deleted') return v
          if (v === 'blacklisted') return v

          return undefined
        }
      },
      searchReporter: { prefix: 'reporter:' },
      searchReportee: { prefix: 'reportee:' },
      predefinedReason: { prefix: 'tag:' }
    })

    return this.restService.addObjectParams(params, filters)
  }
}
