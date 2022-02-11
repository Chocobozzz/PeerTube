import { catchError } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main'
import { VideoEditorCreateEdition, VideoEditorTask } from '@shared/models'

@Injectable()
export class VideoEditorService {

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  editVideo (videoId: number | string, tasks: VideoEditorTask[]) {
    const url = VideoService.BASE_VIDEO_URL + '/' + videoId + '/editor/edit'
    const body: VideoEditorCreateEdition = {
      tasks
    }

    const data = objectToFormData(body)

    return this.authHttp.post(url, data)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
