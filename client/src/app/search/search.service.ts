import { catchError, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { VideoService } from '@app/shared/video/video.service'
import { RestExtractor, RestService } from '@app/shared'
import { environment } from 'environments/environment'
import { ResultList, Video } from '../../../../shared'
import { Video as VideoServerModel } from '@app/shared/video/video.model'

export type SearchResult = {
  videosResult: { totalVideos: number, videos: Video[] }
}

@Injectable()
export class SearchService {
  static BASE_SEARCH_URL = environment.apiUrl + '/api/v1/search/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private videoService: VideoService
  ) {}

  searchVideos (
    search: string,
    componentPagination: ComponentPagination
  ): Observable<{ videos: Video[], totalVideos: number }> {
    const url = SearchService.BASE_SEARCH_URL + 'videos'

    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)
    params = params.append('search', search)

    return this.authHttp
               .get<ResultList<VideoServerModel>>(url, { params })
               .pipe(
                 switchMap(res => this.videoService.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
