import { catchError, map, concatMap, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/api'
import { from as observableFrom, Observable } from 'rxjs'
import { VideoBlacklist, VideoBlacklistType, ResultList } from '../../../../../shared'
import { Video } from '../video/video.model'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'
import { ComponentPaginationLight } from '../rest/component-pagination.model'

@Injectable()
export class VideoBlacklistService {
  private static BASE_VIDEOS_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listBlacklist (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string
    type?: VideoBlacklistType
  }): Observable<ResultList<VideoBlacklist>> {
    const { pagination, sort, search, type } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)
    if (type) params = params.append('type', type.toString())

    return this.authHttp.get<ResultList<VideoBlacklist>>(VideoBlacklistService.BASE_VIDEOS_URL + 'blacklist', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  getAutoBlacklistedAsVideoList (videoPagination: ComponentPaginationLight): Observable<ResultList<Video>> {
    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    // prioritize first created since waiting longest
    const AUTO_BLACKLIST_SORT = 'createdAt'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, AUTO_BLACKLIST_SORT)

    params = params.set('type', VideoBlacklistType.AUTO_BEFORE_PUBLISHED.toString())

    return this.authHttp.get<ResultList<VideoBlacklist>>(VideoBlacklistService.BASE_VIDEOS_URL + 'blacklist', { params })
              .pipe(
                map(res => {
                  return {
                    total: res.total,
                    data: res.data.map(videoBlacklist => new Video(videoBlacklist.video))
                  }
                }),
                catchError(res => this.restExtractor.handleError(res))
              )
  }

  removeVideoFromBlacklist (videoIdArgs: number | number[]) {
    const videoIds = Array.isArray(videoIdArgs) ? videoIdArgs : [ videoIdArgs ]

    return observableFrom(videoIds)
      .pipe(
        concatMap(id => this.authHttp.delete(VideoBlacklistService.BASE_VIDEOS_URL + id + '/blacklist')),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  blacklistVideo (videoId: number, reason: string, unfederate: boolean) {
    const body = {
      unfederate,
      reason
    }

    return this.authHttp.post(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
