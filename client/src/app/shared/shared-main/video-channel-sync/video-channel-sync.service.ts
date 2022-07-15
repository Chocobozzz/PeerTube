import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList } from '@shared/models/common'
import { VideoChannelSync, VideoChannelSyncCreate } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'
import { catchError, Observable } from 'rxjs'
import { environment } from 'src/environments/environment'

@Injectable({
  providedIn: 'root'
})
export class VideoChannelSyncService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels-sync'
  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  getSyncs (parameters: { sort: SortMeta, pagination: RestPagination }): Observable<ResultList<VideoChannelSync>> {
    const { pagination, sort } = parameters
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    const url = VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL + '/me'
    return this.authHttp.get<ResultList<VideoChannelSync>>(url, { params })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  createSync (videoChannelsSyncCreate: VideoChannelSyncCreate) {
    return this.authHttp.post(VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL, videoChannelsSyncCreate)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
  deleteSync (videoChannelsSyncId: number) {
    const url = `${VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL}/${videoChannelsSyncId}`
    return this.authHttp.delete(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  requestTotalSync (syncId: number) {
    const url = `${VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL}/syncAll/${syncId}`
    return this.authHttp.post(url, {})
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
