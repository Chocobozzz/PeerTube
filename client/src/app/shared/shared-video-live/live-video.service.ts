import { catchError } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { LiveVideo, LiveVideoCreate, LiveVideoSession, LiveVideoUpdate, ResultList, VideoCreateResult } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { VideoService } from '../shared-main/video/video.service'

@Injectable()
export class LiveVideoService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  static BASE_VIDEO_LIVE_URL = environment.apiUrl + '/api/v1/videos/live/'

  goLive (video: LiveVideoCreate) {
    return this.authHttp
      .post<{ video: VideoCreateResult }>(LiveVideoService.BASE_VIDEO_LIVE_URL, video)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getVideoLive (videoId: number | string) {
    return this.authHttp
      .get<LiveVideo>(LiveVideoService.BASE_VIDEO_LIVE_URL + videoId)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  listSessions (videoId: number | string) {
    const params = new HttpParams().set('sort', '-startDate')

    return this.authHttp
      .get<ResultList<LiveVideoSession>>(LiveVideoService.BASE_VIDEO_LIVE_URL + videoId + '/sessions', { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  findLiveSessionFromVOD (videoId: number | string) {
    return this.authHttp
      .get<LiveVideoSession>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/live-session')
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateLive (videoId: number | string, liveUpdate: LiveVideoUpdate) {
    return this.authHttp
      .put(LiveVideoService.BASE_VIDEO_LIVE_URL + videoId, liveUpdate)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
