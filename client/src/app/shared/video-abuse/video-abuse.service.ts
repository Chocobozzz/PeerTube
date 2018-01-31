import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { ResultList, VideoAbuse } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'

@Injectable()
export class VideoAbuseService {
  private static BASE_VIDEO_ABUSE_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getVideoAbuses (pagination: RestPagination, sort: SortMeta): Observable<ResultList<VideoAbuse>> {
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + 'abuse'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<VideoAbuse>>(url, { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  reportVideo (id: number, reason: string) {
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + id + '/abuse'
    const body = {
      reason
    }

    return this.authHttp.post(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }
}
