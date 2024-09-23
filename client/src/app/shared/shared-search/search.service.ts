import { Observable, of } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestPagination, RestService } from '@app/core'
import {
  ResultList,
  Video as VideoServerModel,
  VideoChannel as VideoChannelServerModel,
  VideoPlaylist as VideoPlaylistServerModel
} from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { AdvancedSearch } from './advanced-search.model'
import { Video } from '../shared-main/video/video.model'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { VideoService } from '../shared-main/video/video.service'
import { VideoChannelService } from '../shared-main/channel/video-channel.service'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '../shared-video-playlist/video-playlist.service'

@Injectable()
export class SearchService {
  static BASE_SEARCH_URL = environment.apiUrl + '/api/v1/search/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private videoService: VideoService,
    private playlistService: VideoPlaylistService
  ) { }

  searchVideos (parameters: {
    search?: string
    componentPagination?: ComponentPaginationLight
    advancedSearch?: AdvancedSearch
    uuids?: string[]
    skipCount?: boolean
  }): Observable<ResultList<Video>> {
    const { search, uuids, componentPagination, advancedSearch, skipCount } = parameters

    if (advancedSearch?.resultType !== undefined && advancedSearch.resultType !== 'videos') {
      return of({ total: 0, data: [] })
    }

    const url = SearchService.BASE_SEARCH_URL + 'videos'
    let pagination: RestPagination

    if (componentPagination) {
      pagination = this.restService.componentToRestPagination(componentPagination)
    }

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    if (search) params = params.append('search', search)
    if (skipCount === true) params = params.append('skipCount', true)
    if (uuids) params = this.restService.addArrayParams(params, 'uuids', uuids)

    if (advancedSearch) {
      const advancedSearchObject = advancedSearch.toVideosAPIObject()
      params = this.restService.addObjectParams(params, advancedSearchObject)
    }

    return this.authHttp
               .get<ResultList<VideoServerModel>>(url, { params })
               .pipe(
                 switchMap(res => this.videoService.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  searchVideoChannels (parameters: {
    search?: string
    advancedSearch?: AdvancedSearch
    componentPagination?: ComponentPaginationLight
    handles?: string[]
  }): Observable<ResultList<VideoChannel>> {
    const { search, advancedSearch, componentPagination, handles } = parameters

    if (advancedSearch?.resultType !== undefined && advancedSearch.resultType !== 'channels') {
      return of({ total: 0, data: [] })
    }

    const url = SearchService.BASE_SEARCH_URL + 'video-channels'

    let pagination: RestPagination
    if (componentPagination) {
      pagination = this.restService.componentToRestPagination(componentPagination)
    }

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    if (search) params = params.append('search', search)
    if (handles) params = this.restService.addArrayParams(params, 'handles', handles)

    if (advancedSearch) {
      const advancedSearchObject = advancedSearch.toChannelAPIObject()
      params = this.restService.addObjectParams(params, advancedSearchObject)
    }

    return this.authHttp
               .get<ResultList<VideoChannelServerModel>>(url, { params })
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  searchVideoPlaylists (parameters: {
    search?: string
    advancedSearch?: AdvancedSearch
    componentPagination?: ComponentPaginationLight
    uuids?: string[]
  }): Observable<ResultList<VideoPlaylist>> {
    const { search, advancedSearch, componentPagination, uuids } = parameters

    if (advancedSearch?.resultType !== undefined && advancedSearch.resultType !== 'playlists') {
      return of({ total: 0, data: [] })
    }

    const url = SearchService.BASE_SEARCH_URL + 'video-playlists'

    let pagination: RestPagination
    if (componentPagination) {
      pagination = this.restService.componentToRestPagination(componentPagination)
    }

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    if (search) params = params.append('search', search)
    if (uuids) params = this.restService.addArrayParams(params, 'uuids', uuids)

    if (advancedSearch) {
      const advancedSearchObject = advancedSearch.toPlaylistAPIObject()
      params = this.restService.addObjectParams(params, advancedSearchObject)
    }

    return this.authHttp
               .get<ResultList<VideoPlaylistServerModel>>(url, { params })
               .pipe(
                 switchMap(res => this.playlistService.extractPlaylists(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
