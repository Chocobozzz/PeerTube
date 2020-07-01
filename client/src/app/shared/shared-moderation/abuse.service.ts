import { omit } from 'lodash-es'
import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { AbuseUpdate, ResultList, Abuse, AbuseCreate, AbuseState } from '@shared/models'
import { environment } from '../../../environments/environment'

@Injectable()
export class AbuseService {
  private static BASE_ABUSE_URL = environment.apiUrl + '/api/v1/abuses'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getAbuses (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string
  }): Observable<ResultList<Abuse>> {
    const { pagination, sort, search } = options
    const url = AbuseService.BASE_ABUSE_URL + 'abuse'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
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

      params = this.restService.addObjectParams(params, filters)
    }

    return this.authHttp.get<ResultList<Abuse>>(url, { params })
               .pipe(
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  reportVideo (parameters: AbuseCreate) {
    const url = AbuseService.BASE_ABUSE_URL

    const body = omit(parameters, [ 'id' ])

    return this.authHttp.post(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  updateAbuse (abuse: Abuse, abuseUpdate: AbuseUpdate) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id

    return this.authHttp.put(url, abuseUpdate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  removeAbuse (abuse: Abuse) {
    const url = AbuseService.BASE_ABUSE_URL + '/' + abuse.id

    return this.authHttp.delete(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }}
