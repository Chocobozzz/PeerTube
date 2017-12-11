import { HttpClient, HttpParams, HttpRequest } from '@angular/common/http'
import { Injectable } from '@angular/core'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { Video as VideoServerModel, VideoDetails as VideoDetailsServerModel } from '../../../../../shared'
import { ResultList } from '../../../../../shared/models/result-list.model'
import { UserVideoRateUpdate } from '../../../../../shared/models/videos/user-video-rate-update.model'
import { UserVideoRate } from '../../../../../shared/models/videos/user-video-rate.model'
import { VideoRateType } from '../../../../../shared/models/videos/video-rate.type'
import { VideoUpdate } from '../../../../../shared/models/videos/video-update.model'
import { RestExtractor } from '../rest/rest-extractor.service'
import { RestService } from '../rest/rest.service'
import { Search } from '../header/search.model'
import { UserService } from '../users/user.service'
import { SortField } from './sort-field.type'
import { VideoDetails } from './video-details.model'
import { VideoEdit } from './video-edit.model'
import { VideoPagination } from './video-pagination.model'
import { Video } from './video.model'

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = API_URL + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getVideo (uuid: string): Observable<VideoDetails> {
    return this.authHttp.get<VideoDetailsServerModel>(VideoService.BASE_VIDEO_URL + uuid)
                        .map(videoHash => new VideoDetails(videoHash))
                        .catch((res) => this.restExtractor.handleError(res))
  }

  viewVideo (uuid: string): Observable<VideoDetails> {
    return this.authHttp.post(VideoService.BASE_VIDEO_URL + uuid + '/views', {})
      .map(this.restExtractor.extractDataBool)
      .catch(this.restExtractor.handleError)
  }

  updateVideo (video: VideoEdit) {
    const language = video.language || undefined
    const licence = video.licence || undefined
    const category = video.category || undefined
    const description = video.description || undefined

    const body: VideoUpdate = {
      name: video.name,
      category,
      licence,
      language,
      description,
      privacy: video.privacy,
      tags: video.tags,
      nsfw: video.nsfw
    }

    return this.authHttp.put(VideoService.BASE_VIDEO_URL + video.id, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(this.restExtractor.handleError)
  }

  uploadVideo (video: FormData) {
    const req = new HttpRequest('POST', VideoService.BASE_VIDEO_URL + 'upload', video, { reportProgress: true })

    return this.authHttp
      .request(req)
      .catch(this.restExtractor.handleError)
  }

  getMyVideos (videoPagination: VideoPagination, sort: SortField): Observable<{ videos: Video[], totalVideos: number}> {
    const pagination = this.videoPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get(UserService.BASE_USERS_URL + '/me/videos', { params })
      .map(this.extractVideos)
      .catch((res) => this.restExtractor.handleError(res))
  }

  getVideos (videoPagination: VideoPagination, sort: SortField): Observable<{ videos: Video[], totalVideos: number}> {
    const pagination = this.videoPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp
      .get(VideoService.BASE_VIDEO_URL, { params })
      .map(this.extractVideos)
      .catch((res) => this.restExtractor.handleError(res))
  }

  searchVideos (search: string, videoPagination: VideoPagination, sort: SortField): Observable<{ videos: Video[], totalVideos: number}> {
    const url = VideoService.BASE_VIDEO_URL + 'search'

    const pagination = this.videoPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.append('search', search)

    return this.authHttp
      .get<ResultList<VideoServerModel>>(url, { params })
      .map(this.extractVideos)
      .catch((res) => this.restExtractor.handleError(res))
  }

  removeVideo (id: number) {
    return this.authHttp
      .delete(VideoService.BASE_VIDEO_URL + id)
      .map(this.restExtractor.extractDataBool)
      .catch((res) => this.restExtractor.handleError(res))
  }

  loadCompleteDescription (descriptionPath: string) {
    return this.authHttp
      .get(API_URL + descriptionPath)
      .map(res => res['description'])
      .catch((res) => this.restExtractor.handleError(res))
  }

  setVideoLike (id: number) {
    return this.setVideoRate(id, 'like')
  }

  setVideoDislike (id: number) {
    return this.setVideoRate(id, 'dislike')
  }

  getUserVideoRating (id: number): Observable<UserVideoRate> {
    const url = UserService.BASE_USERS_URL + 'me/videos/' + id + '/rating'

    return this.authHttp
      .get(url)
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

    return this.authHttp
      .put(url, body)
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
