import { Injectable } from '@angular/core'
import { Http, Headers, RequestOptions } from '@angular/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { Search } from '../../shared'
import { SortField } from './sort-field.type'
import { RateType } from './rate-type.type'
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
    return this.http.get(VideoService.BASE_VIDEO_URL + 'categories')
                    .map(this.restExtractor.extractDataGet)
                    .subscribe(data => {
                      Object.keys(data).forEach(categoryKey => {
                        this.videoCategories.push({
                          id: parseInt(categoryKey, 10),
                          label: data[categoryKey]
                        })
                      })
                    })
  }

  loadVideoLicences () {
    return this.http.get(VideoService.BASE_VIDEO_URL + 'licences')
                    .map(this.restExtractor.extractDataGet)
                    .subscribe(data => {
                      Object.keys(data).forEach(licenceKey => {
                        this.videoLicences.push({
                          id: parseInt(licenceKey, 10),
                          label: data[licenceKey]
                        })
                      })
                    })
  }

  loadVideoLanguages () {
    return this.http.get(VideoService.BASE_VIDEO_URL + 'languages')
                    .map(this.restExtractor.extractDataGet)
                    .subscribe(data => {
                      Object.keys(data).forEach(languageKey => {
                        this.videoLanguages.push({
                          id: parseInt(languageKey, 10),
                          label: data[languageKey]
                        })
                      })
                    })
  }

  getVideo (id: string): Observable<Video> {
    return this.http.get(VideoService.BASE_VIDEO_URL + id)
                    .map(this.restExtractor.extractDataGet)
                    .map(videoHash => new Video(videoHash))
                    .catch((res) => this.restExtractor.handleError(res))
  }

  updateVideo (video: Video) {
    const language = video.language ? video.language : null

    const body = {
      name: video.name,
      category: video.category,
      licence: video.licence,
      language,
      description: video.description,
      tags: video.tags
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
    const body = {
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

  getUserVideoRating (id: string) {
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

  private setVideoRate (id: string, rateType: RateType) {
    const url = VideoService.BASE_VIDEO_URL + id + '/rate'
    const body = {
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
}
