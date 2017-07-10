import { Injectable } from '@angular/core'
import { Http, Headers, RequestOptions } from '@angular/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { Search } from '../../shared'
import { SortField } from './sort-field.type'
import { AuthService } from '../../core'
import {
  AuthHttp,
  RestExtractor,
  RestPagination,
  RestService,
  ResultList,
  UserService
} from '../../shared'
import { Video } from './video.model'
import {
  UserVideoRate,
  VideoRateType,
  VideoUpdate,
  VideoAbuseCreate,
  UserVideoRateUpdate
} from '../../../../../shared'

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  videoCategories: Array<{ id: number, label: string }> = []
  videoLicences: Array<{ id: number, label: string }> = []
  videoLanguages: Array<{ id: number, label: string }> = []

  constructor (
    private authService: AuthService,
    private authHttp: AuthHttp,
    private http: Http,
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

  getVideo (id: string): Observable<Video> {
    return this.http.get(VideoService.BASE_VIDEO_URL + id)
                    .map(this.restExtractor.extractDataGet)
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

    const headers = new Headers({ 'Content-Type': 'application/json' })
    const options = new RequestOptions({ headers: headers })

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${video.id}`, body, options)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError)
  }

  getVideos (pagination: RestPagination, sort: SortField) {
    const params = this.restService.buildRestGetParams(pagination, sort)

    return this.http.get(VideoService.BASE_VIDEO_URL, { search: params })
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch((res) => this.restExtractor.handleError(res))
  }

  removeVideo (id: string) {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + id)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  searchVideos (search: Search, pagination: RestPagination, sort: SortField) {
    const params = this.restService.buildRestGetParams(pagination, sort)

    if (search.field) params.set('field', search.field)

    return this.http.get(VideoService.BASE_VIDEO_URL + 'search/' + encodeURIComponent(search.value), { search: params })
                    .map(this.restExtractor.extractDataList)
                    .map(this.extractVideos)
                    .catch((res) => this.restExtractor.handleError(res))
  }

  reportVideo (id: string, reason: string) {
    const url = VideoService.BASE_VIDEO_URL + id + '/abuse'
    const body: VideoAbuseCreate = {
      reason
    }

    return this.authHttp.post(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  setVideoLike (id: string) {
    return this.setVideoRate(id, 'like')
  }

  setVideoDislike (id: string) {
    return this.setVideoRate(id, 'dislike')
  }

  getUserVideoRating (id: string): Observable<UserVideoRate> {
    const url = UserService.BASE_USERS_URL + '/me/videos/' + id + '/rating'

    return this.authHttp.get(url)
                        .map(this.restExtractor.extractDataGet)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  blacklistVideo (id: string) {
    return this.authHttp.post(VideoService.BASE_VIDEO_URL + id + '/blacklist', {})
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  private setVideoRate (id: string, rateType: VideoRateType) {
    const url = VideoService.BASE_VIDEO_URL + id + '/rate'
    const body: UserVideoRateUpdate = {
      rating: rateType
    }

    return this.authHttp.put(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  private extractVideos (result: ResultList) {
    const videosJson = result.data
    const totalVideos = result.total
    const videos = []
    for (const videoJson of videosJson) {
      videos.push(new Video(videoJson))
    }

    return { videos, totalVideos }
  }

  private loadVideoAttributeEnum (attributeName: 'categories' | 'licences' | 'languages', hashToPopulate: { id: number, label: string }[]) {
    return this.http.get(VideoService.BASE_VIDEO_URL + attributeName)
                    .map(this.restExtractor.extractDataGet)
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
