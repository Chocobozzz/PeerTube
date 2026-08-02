import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, WatchedWordsSubscription } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { catchError } from 'rxjs/operators'
import { environment } from '../../../environments/environment'

@Injectable()
export class WatchedWordsSubscriptionService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  private static BASE_WATCHED_WORDS_URL = environment.apiUrl + '/api/v1/watched-words/'

  listSubscriptions (options: {
    accountName?: string
    pagination: RestPagination
    sort: SortMeta
    search?: string
  }) {
    const { pagination, sort, search } = options
    const url = this.buildSubscriptionsPath(options)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)

    return this.authHttp.get<ResultList<WatchedWordsSubscription>>(url, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  addSubscription (options: {
    accountName?: string
    url: string
  }) {
    return this.authHttp.post<WatchedWordsSubscription>(this.buildSubscriptionsPath(options), { url: options.url })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteSubscription (options: {
    accountName?: string
    id: number
  }) {
    return this.authHttp.delete(this.buildSubscriptionsPath(options) + '/' + options.id)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private buildSubscriptionsPath (options: { accountName?: string }) {
    const suffixPath = options.accountName
      ? '/accounts/' + options.accountName + '/subscriptions'
      : '/server/subscriptions'

    return WatchedWordsSubscriptionService.BASE_WATCHED_WORDS_URL + suffixPath
  }
}
