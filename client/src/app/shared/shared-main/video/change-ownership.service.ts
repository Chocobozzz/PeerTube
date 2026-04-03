import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import {
  ChangeOwnership,
  ChangeOwnershipAccept,
  ChangeOwnershipCreate,
  ChangeOwnershipStateType,
  ResultList
} from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { from, Observable } from 'rxjs'
import { catchError, concatMap, toArray } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'

@Injectable()
export class ChangeOwnershipService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_VIDEO_CHANGE_OWNERSHIP_URL = environment.apiUrl + '/api/v1/videos/'

  sendVideoChangeRequest (id: number, username: string) {
    const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + id + '/give-ownership'
    const body: ChangeOwnershipCreate = {
      username
    }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  listOfVideos (pagination: RestPagination, sort: SortMeta): Observable<ResultList<ChangeOwnership>> {
    const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<ChangeOwnership>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  listFromVideo (videoId: number, state: ChangeOwnershipStateType): Observable<ResultList<ChangeOwnership>> {
    const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + videoId + '/ownership'

    let params = new HttpParams()
    params = params.set('state', state)

    return this.authHttp.get<ResultList<ChangeOwnership>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  acceptVideo (ids: number[], input: ChangeOwnershipAccept) {
    return from(ids)
      .pipe(
        concatMap(id => {
          const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/accept'

          return this.authHttp.post(url, input)
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  rejectVideo (ids: number[]) {
    return from(ids)
      .pipe(
        concatMap(id => {
          const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/refuse'

          return this.authHttp.post(url, {})
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  cancelVideo (id: number) {
    const url = ChangeOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------
}
