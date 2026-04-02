import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import {
  ResultList,
  VideoChangeOwnership,
  VideoChangeOwnershipAccept,
  VideoChangeOwnershipCreate,
  VideoChangeOwnershipStatusType
} from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'

@Injectable()
export class VideoOwnershipService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_VIDEO_CHANGE_OWNERSHIP_URL = environment.apiUrl + '/api/v1/videos/'

  sendChangeRequest (id: number, username: string) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + id + '/give-ownership'
    const body: VideoChangeOwnershipCreate = {
      username
    }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  list (pagination: RestPagination, sort: SortMeta): Observable<ResultList<VideoChangeOwnership>> {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<VideoChangeOwnership>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  listFromVideo (videoId: number, state: VideoChangeOwnershipStatusType): Observable<ResultList<VideoChangeOwnership>> {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + videoId + '/ownership'

    let params = new HttpParams()
    params = params.set('state', state)

    return this.authHttp.get<ResultList<VideoChangeOwnership>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  accept (id: number, input: VideoChangeOwnershipAccept) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/accept'
    return this.authHttp.post(url, input)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  refuse (id: number) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/refuse'
    return this.authHttp.post(url, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  cancel (id: number) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
