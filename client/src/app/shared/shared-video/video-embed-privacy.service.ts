import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { VideoEmbedPrivacy, VideoEmbedPrivacyUpdate } from '@peertube/peertube-models'
import { catchError } from 'rxjs'
import { VideoService } from '../shared-main/video/video.service'

@Injectable()
export class VideoEmbedPrivacyService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  getPrivacy (options: {
    videoId: string
  }) {
    const path = `${VideoService.BASE_VIDEO_URL}/${options.videoId}/embed-privacy`

    return this.authHttp.get<VideoEmbedPrivacy>(path)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updatePrivacy (options: {
    videoId: string
    settings: VideoEmbedPrivacyUpdate
  }) {
    const path = `${VideoService.BASE_VIDEO_URL}/${options.videoId}/embed-privacy`

    return this.authHttp.put(path, options.settings)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
