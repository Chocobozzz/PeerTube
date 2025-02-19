import { ResultList, VideoPassword } from '@peertube/peertube-models'
import { Injectable, inject } from '@angular/core'
import { catchError, switchMap } from 'rxjs'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RestExtractor } from '@app/core'
import { VideoService } from './video.service'

@Injectable()
export class VideoPasswordService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  static buildVideoPasswordHeader (videoPassword: string) {
    return videoPassword
      ? new HttpHeaders().set('x-peertube-video-password', videoPassword)
      : undefined
  }

  getVideoPasswords (options: { videoUUID: string }) {
    return this.authHttp.get<ResultList<VideoPassword>>(`${VideoService.BASE_VIDEO_URL}/${options.videoUUID}/passwords`)
      .pipe(
        switchMap(res => res.data),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
