import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { LiveVideo, LiveVideoCreate, LiveVideoSession, LiveVideoUpdate, ResultList, VideoCreateResult } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { VideoService } from '../shared-main/video/video.service'

@Injectable()
export class LiveVideoService {
  static BASE_VIDEO_LIVE_URL = environment.apiUrl + '/api/v1/videos/live/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

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
    return this.authHttp
               .get<ResultList<LiveVideoSession>>(LiveVideoService.BASE_VIDEO_LIVE_URL + videoId + '/sessions')
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
