import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams, HttpRequest } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { Video as VideoServerModel, VideoDetails as VideoDetailsServerModel } from '../../../../../shared'
import { ResultList } from '../../../../../shared/models/result-list.model'
import {
  UserVideoRate,
  UserVideoRateType,
  UserVideoRateUpdate,
  VideoConstant,
  VideoFilter,
  VideoPrivacy,
  VideoUpdate
} from '../../../../../shared/models/videos'
import { FeedFormat } from '../../../../../shared/models/feeds/feed-format.enum'
import { environment } from '../../../environments/environment'
import { ComponentPaginationLight } from '../rest/component-pagination.model'
import { RestExtractor } from '../rest/rest-extractor.service'
import { RestService } from '../rest/rest.service'
import { UserService } from '../users/user.service'
import { VideoSortField } from './sort-field.type'
import { VideoDetails } from './video-details.model'
import { VideoEdit } from './video-edit.model'
import { Video } from './video.model'
import { objectToFormData } from '@app/shared/misc/utils'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { ServerService, AuthService } from '@app/core'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'

export interface VideosProvider {
  getVideos (parameters: {
    videoPagination: ComponentPaginationLight,
    sort: VideoSortField,
    filter?: VideoFilter,
    categoryOneOf?: number,
    languageOneOf?: string[]
  }): Observable<ResultList<Video>>
}

@Injectable()
export class VideoService implements VideosProvider {
  static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  static BASE_FEEDS_URL = environment.apiUrl + '/feeds/videos.'

  constructor (
    private authHttp: HttpClient,
    private authService: AuthService,
    private userService: UserService,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private serverService: ServerService,
    private i18n: I18n
  ) {}

  getVideoViewUrl (uuid: string) {
    return VideoService.BASE_VIDEO_URL + uuid + '/views'
  }

  getUserWatchingVideoUrl (uuid: string) {
    return VideoService.BASE_VIDEO_URL + uuid + '/watching'
  }

  getVideo (options: { videoId: string }): Observable<VideoDetails> {
    return this.serverService.getServerLocale()
               .pipe(
                 switchMap(translations => {
                   return this.authHttp.get<VideoDetailsServerModel>(VideoService.BASE_VIDEO_URL + options.videoId)
                              .pipe(map(videoHash => ({ videoHash, translations })))
                 }),
                 map(({ videoHash, translations }) => new VideoDetails(videoHash, translations)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideo (video: VideoEdit) {
    const language = video.language || null
    const licence = video.licence || null
    const category = video.category || null
    const description = video.description || null
    const support = video.support || null
    const scheduleUpdate = video.scheduleUpdate || null
    const originallyPublishedAt = video.originallyPublishedAt || null

    const body: VideoUpdate = {
      name: video.name,
      category,
      licence,
      language,
      support,
      description,
      channelId: video.channelId,
      privacy: video.privacy,
      tags: video.tags,
      nsfw: video.nsfw,
      waitTranscoding: video.waitTranscoding,
      commentsEnabled: video.commentsEnabled,
      downloadEnabled: video.downloadEnabled,
      thumbnailfile: video.thumbnailfile,
      previewfile: video.previewfile,
      scheduleUpdate,
      originallyPublishedAt
    }

    const data = objectToFormData(body)

    return this.authHttp.put(VideoService.BASE_VIDEO_URL + video.id, data)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  uploadVideo (video: FormData) {
    const req = new HttpRequest('POST', VideoService.BASE_VIDEO_URL + 'upload', video, { reportProgress: true })

    return this.authHttp
               .request<{ video: { id: number, uuid: string } }>(req)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getMyVideos (videoPagination: ComponentPaginationLight, sort: VideoSortField, search?: string): Observable<ResultList<Video>> {
    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = this.restService.addObjectParams(params, { search })

    return this.authHttp
               .get<ResultList<Video>>(UserService.BASE_USERS_URL + 'me/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getAccountVideos (
    account: Account,
    videoPagination: ComponentPaginationLight,
    sort: VideoSortField
  ): Observable<ResultList<Video>> {
    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp
               .get<ResultList<Video>>(AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideoChannelVideos (
    videoChannel: VideoChannel,
    videoPagination: ComponentPaginationLight,
    sort: VideoSortField
  ): Observable<ResultList<Video>> {
    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp
               .get<ResultList<Video>>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getUserSubscriptionVideos (parameters: {
    videoPagination: ComponentPaginationLight,
    sort: VideoSortField,
    skipCount?: boolean
  }): Observable<ResultList<Video>> {
    const { videoPagination, sort, skipCount } = parameters
    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (skipCount) params = params.set('skipCount', skipCount + '')

    return this.authHttp
               .get<ResultList<Video>>(UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideos (parameters: {
    videoPagination: ComponentPaginationLight,
    sort: VideoSortField,
    filter?: VideoFilter,
    categoryOneOf?: number,
    languageOneOf?: string[],
    skipCount?: boolean,
    nsfw?: boolean
  }): Observable<ResultList<Video>> {
    const { videoPagination, sort, filter, categoryOneOf, languageOneOf, skipCount, nsfw } = parameters

    const pagination = this.restService.componentPaginationToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (filter) params = params.set('filter', filter)
    if (categoryOneOf) params = params.set('categoryOneOf', categoryOneOf + '')
    if (skipCount) params = params.set('skipCount', skipCount + '')

    if (nsfw) {
      params = params.set('nsfw', nsfw + '')
    } else {
      const nsfwPolicy = this.authService.isLoggedIn()
        ? this.authService.getUser().nsfwPolicy
        : this.userService.getAnonymousUser().nsfwPolicy
      if (this.nsfwPolicyToFilter(nsfwPolicy)) params.set('nsfw', 'false')
    }

    if (languageOneOf) {
      for (const l of languageOneOf) {
        params = params.append('languageOneOf[]', l)
      }
    }

    return this.authHttp
               .get<ResultList<Video>>(VideoService.BASE_VIDEO_URL, { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  buildBaseFeedUrls (params: HttpParams) {
    const feeds = [
      {
        format: FeedFormat.RSS,
        label: 'rss 2.0',
        url: VideoService.BASE_FEEDS_URL + FeedFormat.RSS.toLowerCase()
      },
      {
        format: FeedFormat.ATOM,
        label: 'atom 1.0',
        url: VideoService.BASE_FEEDS_URL + FeedFormat.ATOM.toLowerCase()
      },
      {
        format: FeedFormat.JSON,
        label: 'json 1.0',
        url: VideoService.BASE_FEEDS_URL + FeedFormat.JSON.toLowerCase()
      }
    ]

    if (params && params.keys().length !== 0) {
      for (const feed of feeds) {
        feed.url += '?' + params.toString()
      }
    }

    return feeds
  }

  getVideoFeedUrls (sort: VideoSortField, filter?: VideoFilter, categoryOneOf?: number) {
    let params = this.restService.addRestGetParams(new HttpParams(), undefined, sort)

    if (filter) params = params.set('filter', filter)

    if (categoryOneOf) params = params.set('categoryOneOf', categoryOneOf + '')

    return this.buildBaseFeedUrls(params)
  }

  getAccountFeedUrls (accountId: number) {
    let params = this.restService.addRestGetParams(new HttpParams())
    params = params.set('accountId', accountId.toString())

    return this.buildBaseFeedUrls(params)
  }

  getVideoChannelFeedUrls (videoChannelId: number) {
    let params = this.restService.addRestGetParams(new HttpParams())
    params = params.set('videoChannelId', videoChannelId.toString())

    return this.buildBaseFeedUrls(params)
  }

  removeVideo (id: number) {
    return this.authHttp
               .delete(VideoService.BASE_VIDEO_URL + id)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  loadCompleteDescription (descriptionPath: string) {
    return this.authHttp
               .get<{ description: string }>(environment.apiUrl + descriptionPath)
               .pipe(
                 map(res => res.description),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  setVideoLike (id: number) {
    return this.setVideoRate(id, 'like')
  }

  setVideoDislike (id: number) {
    return this.setVideoRate(id, 'dislike')
  }

  unsetVideoLike (id: number) {
    return this.setVideoRate(id, 'none')
  }

  getUserVideoRating (id: number) {
    const url = UserService.BASE_USERS_URL + 'me/videos/' + id + '/rating'

    return this.authHttp.get<UserVideoRate>(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  extractVideos (result: ResultList<VideoServerModel>) {
    return this.serverService.getServerLocale()
               .pipe(
                 map(translations => {
                   const videosJson = result.data
                   const totalVideos = result.total
                   const videos: Video[] = []

                   for (const videoJson of videosJson) {
                     videos.push(new Video(videoJson, translations))
                   }

                   return { total: totalVideos, data: videos }
                 })
               )
  }

  explainedPrivacyLabels (privacies: VideoConstant<VideoPrivacy>[]) {
    const base = [
      {
        id: VideoPrivacy.PRIVATE,
        label: this.i18n('Only I can see this video')
      },
      {
        id: VideoPrivacy.UNLISTED,
        label: this.i18n('Only people with the private link can see this video')
      },
      {
        id: VideoPrivacy.PUBLIC,
        label: this.i18n('Anyone can see this video')
      },
      {
        id: VideoPrivacy.INTERNAL,
        label: this.i18n('Only users of this instance can see this video')
      }
    ]

    return base.filter(o => !!privacies.find(p => p.id === o.id))
  }

  private setVideoRate (id: number, rateType: UserVideoRateType) {
    const url = VideoService.BASE_VIDEO_URL + id + '/rate'
    const body: UserVideoRateUpdate = {
      rating: rateType
    }

    return this.authHttp
               .put(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  private nsfwPolicyToFilter (policy: NSFWPolicyType) {
    return policy === 'do_not_list'
  }
}
