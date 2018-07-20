import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { VideoChangeOwnershipCreate } from '../../../../../shared/models/videos/video-change-ownership-create.model'

@Injectable()
export class VideoOwnershipService {
  private static BASE_VIDEO_CHANGE_OWNERSHIP_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {
  }

  changeOwnership (id: number, username: string) {
    const url = VideoOwnershipService.BASE_VIDEO_CHANGE_OWNERSHIP_URL + id + '/give-ownership'
    const body: VideoChangeOwnershipCreate = {
      username
    }

    return this.authHttp.post(url, body)
      .pipe(
        map(this.restExtractor.extractDataBool),
        catchError(res => this.restExtractor.handleError(res))
      )
  }
}
