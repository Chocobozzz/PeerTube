import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, WatchedWordsList } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { environment } from '../../../environments/environment'

@Injectable()
export class WatchedWordsListService {
  private static BASE_WATCHED_WORDS_URL = environment.apiUrl + '/api/v1/watched-words/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  list (options: {
    accountName?: string
    pagination: RestPagination
    sort: SortMeta
  }): Observable<ResultList<WatchedWordsList>> {
    const { pagination, sort } = options
    const url = this.buildServerOrAccountListPath(options)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<WatchedWordsList>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  addList (options: {
    accountName?: string
    listName: string
    words: string[]
  }) {
    const { listName, words } = options

    const url = this.buildServerOrAccountListPath(options)
    const body = { listName, words }

    return this.authHttp.post(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateList (options: {
    accountName?: string

    listId: number
    listName: string
    words: string[]
  }) {
    const { listName, words } = options

    const url = this.buildServerOrAccountListPath(options)
    const body = { listName, words }

    return this.authHttp.put(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteList (options: {
    accountName?: string
    listId: number
  }) {
    const url = this.buildServerOrAccountListPath(options)

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private buildServerOrAccountListPath (options: { accountName?: string, listId?: number }) {
    let suffixPath = options.accountName
      ? '/accounts/' + options.accountName + '/lists'
      : '/server/lists'

    if (options.listId) {
      suffixPath += '/' + options.listId
    }

    return WatchedWordsListService.BASE_WATCHED_WORDS_URL + suffixPath
  }
}
