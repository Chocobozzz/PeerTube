import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { HttpClient, HttpParams, HttpRequest } from '@angular/common/http'

import { Search } from '../../shared'
import { SortField } from './sort-field.type'
import {
  RestExtractor,
  RestService,
  UserService
} from '../../shared'
import { Video } from './video.model'
import { VideoDetails } from './video-details.model'
import { VideoEdit } from './video-edit.model'
import { VideoPagination } from './video-pagination.model'
import {
  UserVideoRate,
  VideoRateType,
  VideoUpdate,
  VideoAbuseCreate,
  UserVideoRateUpdate,
  Video as VideoServerModel,
  VideoDetails as VideoDetailsServerModel,
  ResultList
} from '../../../../../shared'

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getVideo (uuid: string) {
    return this.authHttp.get<VideoDetailsServerModel>(VideoService.BASE_VIDEO_URL + uuid)
                        .map(videoHash => new VideoDetails(videoHash))
                        .catch((res) => this.restExtractor.handleError(res))
  }

  updateVideo (video: VideoEdit) {
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

    return this.authHttp.put(VideoService.BASE_VIDEO_URL + video.id, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError)
  }

  uploadVideo (video: FormData) {
    const req = new HttpRequest('POST', VideoService.BASE_VIDEO_URL + 'upload', video, { reportProgress: true })

    return this.authHttp.request(req)
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
    const url = UserService.BASE_USERS_URL + 'me/videos/' + id + '/rating'

    return this.authHttp.get(url)
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
}
