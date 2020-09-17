import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { VideoCreate, VideoLive } from '@shared/models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class VideoLiveService {
  static BASE_VIDEO_LIVE_URL = environment.apiUrl + '/api/v1/videos/live/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  goLive (video: VideoCreate) {
    return this.authHttp
               .post<{ video: { id: number, uuid: string } }>(VideoLiveService.BASE_VIDEO_LIVE_URL, video)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getVideoLive (videoId: number | string) {
    return this.authHttp
               .get<VideoLive>(VideoLiveService.BASE_VIDEO_LIVE_URL + videoId)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
