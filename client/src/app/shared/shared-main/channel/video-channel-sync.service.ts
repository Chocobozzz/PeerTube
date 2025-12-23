import { SortMeta } from 'primeng/api'
import { catchError, Observable } from 'rxjs'
import { environment } from 'src/environments/environment'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, VideoChannelSync, VideoChannelSyncCreate } from '@peertube/peertube-models'
import { Account } from '../account/account.model'
import { AccountService } from '../account/account.service'

@Injectable({
  providedIn: 'root'
})
export class VideoChannelSyncService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channel-syncs'

  listByAccount (parameters: {
    sort: SortMeta
    pagination: RestPagination
    account: Account
    includeCollaborations: boolean
  }): Observable<ResultList<VideoChannelSync>> {
    const { pagination, sort, account, includeCollaborations } = parameters

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (includeCollaborations) {
      params = params.append('includeCollaborations', 'true')
    }

    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-channel-syncs'

    return this.authHttp.get<ResultList<VideoChannelSync>>(url, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  create (body: VideoChannelSyncCreate) {
    return this.authHttp.post<{ videoChannelSync: VideoChannelSync }>(VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  delete (syncId: number) {
    const url = `${VideoChannelSyncService.BASE_VIDEO_CHANNEL_URL}/${syncId}`

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
