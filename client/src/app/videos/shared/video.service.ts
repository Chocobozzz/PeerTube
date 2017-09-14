import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { HttpClient, HttpParams } from '@angular/common/http'

import { Search } from '../../shared'
import { SortField } from './sort-field.type'
import {
  RestExtractor,
  RestService,
  UserService
} from '../../shared'
import { Video } from './video.model'
import { VideoPagination } from './video-pagination.model'
import {
UserVideoRate,
VideoRateType,
VideoUpdate,
VideoAbuseCreate,
UserVideoRateUpdate,
Video as VideoServerModel,
ResultList
} from '../../../../../shared'

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  videoCategories: Array<{ id: number, label: string }> = []
  videoLicences: Array<{ id: number, label: string }> = []
  videoLanguages: Array<{ id: number, label: string }> = []

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  loadVideoCategories () {
    return this.loadVideoAttributeEnum('categories', this.videoCategories)
  }

  loadVideoLicences () {
    return this.loadVideoAttributeEnum('licences', this.videoLicences)
  }

  loadVideoLanguages () {
    return this.loadVideoAttributeEnum('languages', this.videoLanguages)
  }

  getVideo (uuid: string) {
    return this.authHttp.get<VideoServerModel>(VideoService.BASE_VIDEO_URL + uuid)
                        .map(videoHash => new Video(videoHash))
                        .catch((res) => this.restExtractor.handleError(res))
  }

  updateVideo (video: Video) {
    const language = video.language ? video.language : null

    const body: VideoUpdate = {
      name: video.name,
      category: video.category,
      licence: video.licence,
      language,
      description: video.description,
      tags: video.tags,
      nsfw: video.nsfw
    }

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${video.id}`, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError)
  }

  getVideos (videoPagination: VideoPagination, sort: SortField) {
    const pagination = this.videoPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get(VideoService.BASE_VIDEO_URL, { params })
                        .map(this.extractVideos)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  searchVideos (search: Search, videoPagination: VideoPagination, sort: SortField) {
    const url = VideoService.BASE_VIDEO_URL + 'search/' + encodeURIComponent(search.value)

    const pagination = this.videoPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search.field) params.set('field', search.field)

    return this.authHttp.get<ResultList<VideoServerModel>>(url, { params })
                        .map(this.extractVideos)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  removeVideo (id: number) {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + id)
               .map(this.restExtractor.extractDataBool)
               .catch((res) => this.restExtractor.handleError(res))
  }

  reportVideo (id: number, reason: string) {
    const url = VideoService.BASE_VIDEO_URL + id + '/abuse'
    const body: VideoAbuseCreate = {
      reason
    }

    return this.authHttp.post(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  setVideoLike (id: number) {
    return this.setVideoRate(id, 'like')
  }

  setVideoDislike (id: number) {
    return this.setVideoRate(id, 'dislike')
  }

  getUserVideoRating (id: number): Observable<UserVideoRate> {
    const url = UserService.BASE_USERS_URL + '/me/videos/' + id + '/rating'

    return this.authHttp.get(url)
                        .catch(res => this.restExtractor.handleError(res))
  }

  blacklistVideo (id: number) {
    return this.authHttp.post(VideoService.BASE_VIDEO_URL + id + '/blacklist', {})
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  private videoPaginationToRestPagination (videoPagination: VideoPagination) {
    const start: number = (videoPagination.currentPage - 1) * videoPagination.itemsPerPage
    const count: number = videoPagination.itemsPerPage

    return { start, count }
  }

  private setVideoRate (id: number, rateType: VideoRateType) {
    const url = VideoService.BASE_VIDEO_URL + id + '/rate'
    const body: UserVideoRateUpdate = {
      rating: rateType
    }

    return this.authHttp.put(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  private extractVideos (result: ResultList<VideoServerModel>) {
    const videosJson = result.data
    const totalVideos = result.total
    const videos = []

    for (const videoJson of videosJson) {
      videos.push(new Video(videoJson))
    }

    return { videos, totalVideos }
  }

  private loadVideoAttributeEnum (attributeName: 'categories' | 'licences' | 'languages', hashToPopulate: { id: number, label: string }[]) {
    return this.authHttp.get(VideoService.BASE_VIDEO_URL + attributeName)
                        .subscribe(data => {
                          Object.keys(data).forEach(dataKey => {
                            hashToPopulate.push({
                              id: parseInt(dataKey, 10),
                              label: data[dataKey]
                            })
                          })
                        })
  }
}
