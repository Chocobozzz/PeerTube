import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { ComponentPaginationLight } from '@app/shared/rest/component-pagination.model'
import { VideoService } from '@app/shared/video/video.service'
import { RestExtractor, RestService } from '@app/shared'
import { environment } from '../../environments/environment'
import { ResultList, Video as VideoServerModel, VideoChannel as VideoChannelServerModel } from '../../../../shared'
import { Video } from '@app/shared/video/video.model'
import { AdvancedSearch } from '@app/search/advanced-search.model'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'

@Injectable()
export class SearchService {
  static BASE_SEARCH_URL = environment.apiUrl + '/api/v1/search/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private videoService: VideoService
  ) {}

  searchVideos (parameters: {
    search: string,
    componentPagination: ComponentPaginationLight,
    advancedSearch: AdvancedSearch
  }): Observable<ResultList<Video>> {
    const { search, componentPagination, advancedSearch } = parameters

    const url = SearchService.BASE_SEARCH_URL + 'videos'
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    if (search) params = params.append('search', search)

    const advancedSearchObject = advancedSearch.toAPIObject()
    params = this.restService.addObjectParams(params, advancedSearchObject)

    return this.authHttp
               .get<ResultList<VideoServerModel>>(url, { params })
               .pipe(
                 switchMap(res => this.videoService.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  searchVideoChannels (parameters: {
    search: string,
    componentPagination: ComponentPaginationLight
  }): Observable<ResultList<VideoChannel>> {
    const { search, componentPagination } = parameters

    const url = SearchService.BASE_SEARCH_URL + 'video-channels'
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)
    params = params.append('search', search)

    return this.authHttp
               .get<ResultList<VideoChannelServerModel>>(url, { params })
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
