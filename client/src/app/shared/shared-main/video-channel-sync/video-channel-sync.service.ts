import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestService } from '@app/core'
import { VideoChannelSyncCreate } from '@shared/models/videos'
import { catchError } from 'rxjs'
import { environment } from 'src/environments/environment'

@Injectable({
  providedIn: 'root'
})
export class VideoChannelSyncService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels-sync/'
  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) { }

  createSync (videoChannelsSyncCreate: VideoChannelSyncCreate) {
    return this.authHttp.post(VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL, videoChannelsSyncCreate)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
  deleteSync (videoChannelsSyncId: number) {
    const url = VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL + videoChannelsSyncId
    return this.authHttp.delete(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
