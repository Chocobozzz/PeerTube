import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService } from '@app/core'
import { ResultList } from '@shared/models'
import { environment } from '../../../../environments/environment'
import { Video } from '../video/video.model'
import { VideoService } from '../video/video.service'

@Injectable()
export class UserHistoryService {
  static BASE_USER_VIDEOS_HISTORY_URL = environment.apiUrl + '/api/v1/users/me/history/videos'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private videoService: VideoService
  ) {}

  getUserVideosHistory (historyPagination: ComponentPaginationLight) {
    const pagination = this.restService.componentPaginationToRestPagination(historyPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    return this.authHttp
               .get<ResultList<Video>>(UserHistoryService.BASE_USER_VIDEOS_HISTORY_URL, { params })
               .pipe(
                 switchMap(res => this.videoService.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  deleteUserVideosHistory () {
    return this.authHttp
               .post(UserHistoryService.BASE_USER_VIDEOS_HISTORY_URL + '/remove', {})
               .pipe(
                 map(() => this.restExtractor.extractDataBool()),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
