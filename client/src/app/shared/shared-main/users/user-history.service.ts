import { catchError, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService } from '@app/core'
import { ResultList } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'
import { Video } from '../video/video.model'
import { VideoService } from '../video/video.service'

@Injectable()
export class UserHistoryService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)
  private videoService = inject(VideoService)

  static BASE_USER_VIDEOS_HISTORY_URL = environment.apiUrl + '/api/v1/users/me/history/videos'

  list (historyPagination: ComponentPaginationLight, search?: string) {
    const pagination = this.restService.componentToRestPagination(historyPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    if (search) params = params.append('search', search)

    return this.authHttp
      .get<ResultList<Video>>(UserHistoryService.BASE_USER_VIDEOS_HISTORY_URL, { params })
      .pipe(
        switchMap(res => this.videoService.extractVideos(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  deleteElement (video: Video) {
    return this.authHttp
      .delete(UserHistoryService.BASE_USER_VIDEOS_HISTORY_URL + '/' + video.id)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  clearAll () {
    return this.authHttp
      .post(UserHistoryService.BASE_USER_VIDEOS_HISTORY_URL + '/remove', {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
