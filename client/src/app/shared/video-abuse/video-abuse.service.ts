import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { Observable } from 'rxjs'
import { ResultList, VideoAbuse, VideoAbuseUpdate } from '../../../../../shared'
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
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  reportVideo (id: number, reason: string) {
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + id + '/abuse'
    const body = {
      reason
    }

    return this.authHttp.post(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  updateVideoAbuse (videoAbuse: VideoAbuse, abuseUpdate: VideoAbuseUpdate) {
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + videoAbuse.video.uuid + '/abuse/' + videoAbuse.id

    return this.authHttp.put(url, abuseUpdate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  removeVideoAbuse (videoAbuse: VideoAbuse) {
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + videoAbuse.video.uuid + '/abuse/' + videoAbuse.id

    return this.authHttp.delete(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }}
