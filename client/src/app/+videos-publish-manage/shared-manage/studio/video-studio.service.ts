import { catchError } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { VideoStudioCreateEdition, VideoStudioCreateEditionNewVideo, VideoStudioTask } from '@peertube/peertube-models'
import { VideoService } from '@app/shared/shared-main/video/video.service'

@Injectable()
export class VideoStudioService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  editVideo (videoId: number | string, tasks: VideoStudioTask[]) {
    return this.authHttp.post(this.buildUrl(videoId), objectToFormData({ tasks } satisfies VideoStudioCreateEdition))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  editVideoAsNewVideo (videoId: number | string, tasks: VideoStudioTask[]) {
    const body: VideoStudioCreateEdition = { tasks, saveAsNewVideo: true }

    return this.authHttp.post<VideoStudioCreateEditionNewVideo>(this.buildUrl(videoId), objectToFormData(body))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private buildUrl (videoId: number | string) {
    return VideoService.BASE_VIDEO_URL + '/' + videoId + '/studio/edit'
  }
}
