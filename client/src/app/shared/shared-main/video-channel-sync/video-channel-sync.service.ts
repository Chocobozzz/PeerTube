import { SortMeta } from 'primeng/api'
import { catchError, Observable } from 'rxjs'
import { environment } from 'src/environments/environment'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, VideoChannelSync, VideoChannelSyncCreate } from '@peertube/peertube-models'
import { Account } from '../account/account.model'
import { AccountService } from '../account/account.service'

@Injectable({
  providedIn: 'root'
})
export class VideoChannelSyncService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channel-syncs'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  listAccountVideoChannelsSyncs (parameters: {
    sort: SortMeta
    pagination: RestPagination
    account: Account
  }): Observable<ResultList<VideoChannelSync>> {
    const { pagination, sort, account } = parameters

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-channel-syncs'

    return this.authHttp.get<ResultList<VideoChannelSync>>(url, { params })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  createSync (body: VideoChannelSyncCreate) {
    return this.authHttp.post<{ videoChannelSync: VideoChannelSync }>(VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL, body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteSync (videoChannelsSyncId: number) {
    const url = `${VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL}/${videoChannelsSyncId}`

    return this.authHttp.delete(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
