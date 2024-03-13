import { catchError } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { VideoStudioCreateEdition, VideoStudioTask } from '@peertube/peertube-models'
import { VideoService } from '@app/shared/shared-main/video/video.service'

@Injectable()
export class VideoStudioService {

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  editVideo (videoId: number | string, tasks: VideoStudioTask[]) {
    const url = VideoService.BASE_VIDEO_URL + '/' + videoId + '/studio/edit'
    const body: VideoStudioCreateEdition = {
      tasks
    }

    const data = objectToFormData(body)

    return this.authHttp.post(url, data)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
