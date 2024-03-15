import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, VideoChangeOwnership, VideoChangeOwnershipAccept, VideoChangeOwnershipCreate } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class VideoOwnershipService {
  private static BASE_VIDEO_CHANGE_OWNERSHIP_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {
  }

  changeOwnership (id: number, username: string) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + id + '/give-ownership'
    const body: VideoChangeOwnershipCreate = {
      username
    }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getOwnershipChanges (pagination: RestPagination, sort: SortMeta): Observable<ResultList<VideoChangeOwnership>> {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<VideoChangeOwnership>>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  acceptOwnership (id: number, input: VideoChangeOwnershipAccept) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/accept'
    return this.authHttp.post(url, input)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  refuseOwnership (id: number) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + 'ownership/' + id + '/refuse'
    return this.authHttp.post(url, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
