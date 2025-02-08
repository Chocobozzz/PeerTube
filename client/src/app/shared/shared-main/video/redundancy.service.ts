import { SortMeta } from 'primeng/api'
import { concat, Observable } from 'rxjs'
import { catchError, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, Video, VideoRedundanciesTarget, VideoRedundancy } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class RedundancyService {
  static BASE_REDUNDANCY_URL = environment.apiUrl + '/api/v1/server/redundancy'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) { }

  updateRedundancy (host: string, redundancyAllowed: boolean) {
    const url = RedundancyService.BASE_REDUNDANCY_URL + '/' + host

    const body = { redundancyAllowed }

    return this.authHttp.put(url, body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  listVideoRedundancies (options: {
    pagination: RestPagination
    sort: SortMeta
    target?: VideoRedundanciesTarget
  }): Observable<ResultList<VideoRedundancy>> {
    const { pagination, sort, target } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (target) params = params.append('target', target)

    return this.authHttp.get<ResultList<VideoRedundancy>>(RedundancyService.BASE_REDUNDANCY_URL + '/videos', { params })
               .pipe(
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  addVideoRedundancy (video: Video) {
    return this.authHttp.post(RedundancyService.BASE_REDUNDANCY_URL + '/videos', { videoId: video.id })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  removeVideoRedundancies (redundancy: VideoRedundancy) {
    const observables = redundancy.redundancies.streamingPlaylists.map(r => r.id)
      .map(id => this.removeRedundancy(id))

    return concat(...observables)
      .pipe(toArray())
  }

  private removeRedundancy (redundancyId: number) {
    return this.authHttp.delete(RedundancyService.BASE_REDUNDANCY_URL + '/videos/' + redundancyId)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
