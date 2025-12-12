import { HttpClient, HttpParams, HttpRequest } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
  AuthService,
  ComponentPaginationLight,
  ConfirmService,
  RestExtractor,
  RestPagination,
  RestService,
  ServerService,
  UserService
} from '@app/core'
import { objectToFormData } from '@app/helpers'
import { arrayify, buildDownloadFilesUrl, exists } from '@peertube/peertube-core-utils'
import {
  BooleanBothQuery,
  FeedFormat,
  FeedFormatType,
  FeedType,
  FeedType_Type,
  NSFWFlag,
  NSFWPolicyType,
  ResultList,
  ServerErrorCode,
  Storyboard,
  UserVideoRate,
  UserVideoRateType,
  UserVideoRateUpdate,
  VideoChannel as VideoChannelServerModel,
  VideoConstant,
  VideoDetails as VideoDetailsServerModel,
  VideoFile,
  VideoFileMetadata,
  VideoLicence,
  VideoLicenceType,
  VideoPrivacy,
  VideoPrivacyType,
  VideosCommonQuery,
  Video as VideoServerModel,
  VideoSortField,
  VideoSource,
  VideoTranscodingCreate,
  VideoUpdate
} from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { from, Observable, of, throwError } from 'rxjs'
import { catchError, concatMap, map, switchMap, toArray } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'
import { Account } from '../account/account.model'
import { AccountService } from '../account/account.service'
import { VideoChannel } from '../channel/video-channel.model'
import { VideoChannelService } from '../channel/video-channel.service'
import { VideoDetails } from './video-details.model'
import { VideoPasswordService } from './video-password.service'
import { Video } from './video.model'

export type VideoListParams = Omit<VideosCommonQuery, 'start' | 'count' | 'sort'> & {
  videoPagination?: ComponentPaginationLight
  sort: VideoSortField | SortMeta
}

@Injectable()
export class VideoService {
  private auth = inject(AuthService)
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)
  private serverService = inject(ServerService)
  private confirmService = inject(ConfirmService)
  private userService = inject(UserService)

  static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos'
  static BASE_FEEDS_URL = environment.apiUrl + '/feeds/videos.'
  static PODCAST_FEEDS_URL = environment.apiUrl + '/feeds/podcast/videos.xml'
  static BASE_SUBSCRIPTION_FEEDS_URL = environment.apiUrl + '/feeds/subscriptions.'

  getVideoViewUrl (uuid: string) {
    return `${VideoService.BASE_VIDEO_URL}/${uuid}/views`
  }

  getVideo (options: { videoId: string, videoPassword?: string }): Observable<VideoDetails> {
    const headers = VideoPasswordService.buildVideoPasswordHeader(options.videoPassword)

    return this.serverService.getServerLocale().pipe(
      switchMap(translations => {
        return this.authHttp.get<VideoDetailsServerModel>(`${VideoService.BASE_VIDEO_URL}/${options.videoId}`, { headers })
          .pipe(map(videoHash => ({ videoHash, translations })))
      }),
      map(({ videoHash, translations }) => new VideoDetails(videoHash, translations)),
      catchError(err => this.restExtractor.handleError(err))
    )
  }

  updateVideo (id: number | string, video: VideoUpdate) {
    const data = objectToFormData(video)

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${id}`, data)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  uploadVideo (video: FormData) {
    const req = new HttpRequest('POST', `${VideoService.BASE_VIDEO_URL}/upload`, video, { reportProgress: true })

    return this.authHttp
      .request<{ video: { id: number, uuid: string } }>(req)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  removeVideo (idArg: number | number[]) {
    const ids = arrayify(idArg)

    return from(ids)
      .pipe(
        concatMap(id => this.authHttp.delete(`${VideoService.BASE_VIDEO_URL}/${id}`)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  listMyVideos (options: {
    videoPagination?: ComponentPaginationLight
    restPagination?: RestPagination

    sort: VideoSortField | SortMeta
    userChannels?: VideoChannelServerModel[]

    includeCollaborations?: boolean

    isLive?: boolean
    privacyOneOf?: VideoPrivacyType[]
    channelNameOneOf: string[]
    search?: string
  }): Observable<ResultList<Video>> {
    const { videoPagination, restPagination, sort, channelNameOneOf, privacyOneOf, search, includeCollaborations } = options

    const pagination = videoPagination
      ? this.restService.componentToRestPagination(videoPagination)
      : restPagination

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, this.buildListSort(sort))

    const commonFilters: VideosCommonQuery = {}

    if (exists(options.isLive)) commonFilters.isLive = options.isLive
    if (options.search) commonFilters.search = search
    if (options.privacyOneOf) commonFilters.privacyOneOf = privacyOneOf

    params = this.restService.addObjectParams(params, commonFilters)

    if (channelNameOneOf !== undefined && channelNameOneOf.length !== 0) {
      params = this.restService.addArrayParams(params, 'channelNameOneOf', channelNameOneOf)
    }

    if (includeCollaborations) params = params.set('includeCollaborations', 'true')

    return this.authHttp
      .get<ResultList<Video>>(UserService.BASE_USERS_URL + 'me/videos', { params })
      .pipe(
        switchMap(res => this.extractVideos(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  listAccountVideos (
    options: VideoListParams & {
      account: Pick<Account, 'nameWithHost'>
    }
  ): Observable<ResultList<Video>> {
    return this.listVideos({ ...options, account: options.account })
  }

  listChannelVideos (
    options: VideoListParams & {
      videoChannel: Pick<VideoChannel, 'nameWithHost'>
    }
  ): Observable<ResultList<Video>> {
    return this.listVideos({ ...options, videoChannel: options.videoChannel })
  }

  listVideos (
    optionsArg: VideoListParams & {
      videoChannel?: Pick<VideoChannel, 'nameWithHost'>
      account?: Pick<Account, 'nameWithHost'>
    }
  ): Observable<ResultList<Video>> {
    const { account, videoChannel, ...options } = optionsArg

    let params = new HttpParams()
    params = this.buildVideoListParams({ params, ...options })

    let url: string
    if (videoChannel) {
      url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/videos'
    } else if (account) {
      url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/videos'
    } else {
      url = VideoService.BASE_VIDEO_URL
    }

    return this.authHttp
      .get<ResultList<Video>>(url, { params })
      .pipe(
        switchMap(res => this.extractVideos(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  buildVideoListParams (options: VideoListParams & { params: HttpParams }) {
    const {
      params,
      videoPagination,
      sort,
      categoryOneOf,
      languageOneOf,
      privacyOneOf,
      skipCount,
      search,
      nsfw,
      nsfwFlagsExcluded,
      nsfwFlagsIncluded,

      ...otherOptions
    } = options

    const pagination = videoPagination
      ? this.restService.componentToRestPagination(videoPagination)
      : undefined

    let newParams = this.restService.addRestGetParams(params, pagination, this.buildListSort(sort))

    if (skipCount) newParams = newParams.set('skipCount', skipCount + '')
    if (Array.isArray(languageOneOf)) newParams = this.restService.addArrayParams(newParams, 'languageOneOf', languageOneOf)
    if (Array.isArray(categoryOneOf)) newParams = this.restService.addArrayParams(newParams, 'categoryOneOf', categoryOneOf)
    if (Array.isArray(privacyOneOf)) newParams = this.restService.addArrayParams(newParams, 'privacyOneOf', privacyOneOf)
    if (search) newParams = newParams.set('search', search)

    newParams = this.buildNSFWParams(newParams, { nsfw, nsfwFlagsExcluded, nsfwFlagsIncluded })

    return this.restService.addObjectParams(newParams, otherOptions)
  }

  buildNSFWParams (params: HttpParams, options: Pick<VideoListParams, 'nsfw' | 'nsfwFlagsExcluded' | 'nsfwFlagsIncluded'> = {}) {
    const { nsfw, nsfwFlagsExcluded, nsfwFlagsIncluded } = options

    const anonymous = this.auth.isLoggedIn()
      ? undefined
      : this.userService.getAnonymousUser()

    const anonymousFlagsExcluded = anonymous
      ? anonymous.nsfwFlagsHidden
      : undefined

    const anonymousFlagsIncluded = anonymous
      ? anonymous.nsfwFlagsDisplayed | anonymous.nsfwFlagsBlurred | anonymous.nsfwFlagsWarned
      : undefined

    if (nsfw !== undefined) params = params.set('nsfw', nsfw)
    else if (anonymous?.nsfwPolicy) params = params.set('nsfw', this.nsfwPolicyToParam(anonymous.nsfwPolicy))

    if (nsfwFlagsExcluded !== undefined) params = params.set('nsfwFlagsExcluded', nsfwFlagsExcluded)
    else if (anonymousFlagsExcluded !== undefined) params = params.set('nsfwFlagsExcluded', anonymousFlagsExcluded)

    if (nsfwFlagsIncluded !== undefined) params = params.set('nsfwFlagsIncluded', nsfwFlagsIncluded)
    else if (anonymousFlagsIncluded !== undefined) params = params.set('nsfwFlagsIncluded', anonymousFlagsIncluded)

    return params
  }

  private buildListSort (sortArg: VideoSortField | SortMeta) {
    const sort = this.restService.buildSortString(sortArg)

    if (typeof sort === 'string') {
      // Silently use the best algorithm for logged in users if they chose the hot algorithm
      if (
        this.auth.isLoggedIn() &&
        (sort === 'hot' || sort === '-hot')
      ) {
        return sort.replace('hot', 'best')
      }

      return sort
    }
  }

  // ---------------------------------------------------------------------------
  // Video feeds
  // ---------------------------------------------------------------------------

  buildBaseFeedUrls (params: HttpParams, base = VideoService.BASE_FEEDS_URL) {
    const feeds: { type: FeedType_Type, format: FeedFormatType, label: string, url: string }[] = [
      {
        type: FeedType.VIDEOS,
        format: FeedFormat.RSS,
        label: 'media rss 2.0',
        url: base + FeedFormat.RSS.toLowerCase()
      },
      {
        type: FeedType.VIDEOS,
        format: FeedFormat.ATOM,
        label: 'atom 1.0',
        url: base + FeedFormat.ATOM.toLowerCase()
      },
      {
        type: FeedType.VIDEOS,
        format: FeedFormat.JSON,
        label: 'json 1.0',
        url: base + FeedFormat.JSON.toLowerCase()
      }
    ]

    if (params && params.keys().length !== 0) {
      for (const feed of feeds) {
        feed.url += '?' + params.toString()
      }
    }

    return feeds
  }

  getVideoFeedUrls (sort: VideoSortField, isLocal: boolean, categoryOneOf?: number[]) {
    let params = this.restService.addRestGetParams(new HttpParams(), undefined, sort)

    if (isLocal) params = params.set('isLocal', isLocal)

    if (categoryOneOf) {
      for (const c of categoryOneOf) {
        params = params.append('categoryOneOf[]', c + '')
      }
    }

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

    const feedUrls = this.buildBaseFeedUrls(params)

    feedUrls.push({
      type: FeedType.PODCAST,
      format: FeedFormat.PODCAST,
      label: 'podcast rss 2.0',
      url: VideoService.PODCAST_FEEDS_URL + `?videoChannelId=${videoChannelId}`
    })

    return feedUrls
  }

  getVideoSubscriptionFeedUrls (accountId: number, feedToken: string) {
    let params = this.restService.addRestGetParams(new HttpParams())
    params = params.set('accountId', accountId.toString())
    params = params.set('token', feedToken)

    return this.buildBaseFeedUrls(params, VideoService.BASE_SUBSCRIPTION_FEEDS_URL)
  }

  // ---------------------------------------------------------------------------
  // Video files
  // ---------------------------------------------------------------------------

  getVideoFileMetadata (metadataUrl: string) {
    return this.authHttp
      .get<VideoFileMetadata>(metadataUrl)
      .pipe(
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeVideoFiles (videoIds: (number | string)[], type: 'hls' | 'web-videos') {
    return from(videoIds)
      .pipe(
        concatMap(id => this.authHttp.delete(VideoService.BASE_VIDEO_URL + '/' + id + '/' + type)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeFile (videoId: number | string, fileId: number, type: 'hls' | 'web-videos') {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + '/' + videoId + '/' + type + '/' + fileId)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  removeSourceFile (videoId: number | string) {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + '/' + videoId + '/source/file')
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  runTranscoding (options: {
    videos: Video[]
    type: 'hls' | 'web-video'
    forceTranscoding?: boolean
  }): Observable<any> {
    const { videos, type, forceTranscoding } = options

    const body: VideoTranscodingCreate = { transcodingType: type, forceTranscoding }

    return from(videos)
      .pipe(
        concatMap(video => {
          return this.authHttp.post(VideoService.BASE_VIDEO_URL + '/' + video.uuid + '/transcoding', body)
            .pipe(
              catchError(err => {
                if (err.error?.code === ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCODED && !forceTranscoding) {
                  const message = $localize`PeerTube considers video "${video.name}" is already being transcoded.` +
                    // eslint-disable-next-line max-len
                    $localize` If you think PeerTube is wrong (video in broken state after a crash etc.), you can force transcoding on this video.` +
                    ` Do you still want to run transcoding?`

                  return from(this.confirmService.confirm(message, $localize`Force transcoding`))
                    .pipe(
                      switchMap(res => {
                        if (res === false) return throwError(() => err)

                        return this.runTranscoding({
                          videos: [ video ],
                          type,
                          forceTranscoding: true
                        })
                      })
                    )
                }

                return throwError(() => err)
              })
            )
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  // ---------------------------------------------------------------------------

  generateDownloadUrl (options: {
    video: Video
    files: VideoFile[]
    videoFileToken?: string
  }) {
    const { video, files, videoFileToken } = options

    return buildDownloadFilesUrl({
      baseUrl: environment.originServerUrl,
      videoFiles: files.map(f => f.id),
      videoUUID: video.uuid,
      videoFileToken
    })
  }

  // ---------------------------------------------------------------------------

  getStoryboards (videoId: string | number, videoPassword: string) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    return this.authHttp
      .get<{ storyboards: Storyboard[] }>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/storyboards', { headers })
      .pipe(
        map(({ storyboards }) => storyboards),
        catchError(err => {
          if (err.status === 404) {
            return of([])
          }

          return this.restExtractor.handleError(err)
        })
      )
  }

  // ---------------------------------------------------------------------------

  getSource (videoId: number) {
    return this.authHttp
      .get<VideoSource>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/source')
      .pipe(
        catchError(err => {
          if (err.status === 404) {
            return of(undefined)
          }

          return this.restExtractor.handleError(err)
        })
      )
  }

  // ---------------------------------------------------------------------------

  setVideoLike (id: string, videoPassword: string) {
    return this.setVideoRate(id, 'like', videoPassword)
  }

  setVideoDislike (id: string, videoPassword: string) {
    return this.setVideoRate(id, 'dislike', videoPassword)
  }

  unsetVideoLike (id: string, videoPassword: string) {
    return this.setVideoRate(id, 'none', videoPassword)
  }

  // ---------------------------------------------------------------------------

  getUserVideoRating (id: string) {
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

  // ---------------------------------------------------------------------------

  explainedPrivacyLabels (serverPrivacies: VideoConstant<VideoPrivacyType>[], defaultPrivacyId: VideoPrivacyType = VideoPrivacy.PUBLIC) {
    const descriptions = {
      [VideoPrivacy.PRIVATE]: $localize`Only I can see this video`,
      [VideoPrivacy.UNLISTED]: $localize`Only shareable via a private link`,
      [VideoPrivacy.PUBLIC]: $localize`Anyone can see this video`,
      [VideoPrivacy.INTERNAL]: $localize`Only users of this platform can see this video`,
      [VideoPrivacy.PASSWORD_PROTECTED]: $localize`Only users with the appropriate password can see this video`,
      [VideoPrivacy.PREMIERE]: $localize`Video will be available soon`
    }

    const videoPrivacies = serverPrivacies.map(p => {
      return {
        ...p,

        description: descriptions[p.id]
      }
    })

    return {
      videoPrivacies,
      defaultPrivacyId: serverPrivacies.find(p => p.id === defaultPrivacyId)?.id || serverPrivacies[0].id
    }
  }

  explainedLicenceLabels (serverLicences: VideoConstant<VideoLicenceType>[]) {
    const descriptions = {
      [VideoLicence['CC-BY']]: $localize`CC-BY`,
      [VideoLicence['CC-BY-SA']]: $localize`CC-BY-SA`,
      [VideoLicence['CC-BY-ND']]: $localize`CC-BY-ND`,
      [VideoLicence['CC-BY-NC']]: $localize`CC-BY-NC`,
      [VideoLicence['CC-BY-NC-SA']]: $localize`CC-BY-NC-SA`,
      [VideoLicence['CC-BY-NC-ND']]: $localize`CC-BY-NC-ND`,
      [VideoLicence['CC0']]: '',
      [VideoLicence.PDM]: $localize`Public domain mark`,
      [VideoLicence['COPYRIGHT']]: $localize`You are the owner of the content or you have the rights of the copyright holders`
    }

    return serverLicences.map(p => {
      return {
        ...p,

        description: descriptions[p.id]
      }
    })
  }

  // ---------------------------------------------------------------------------

  buildNSFWTooltip (video: Pick<VideoServerModel, 'nsfw' | 'nsfwFlags'>) {
    const flags: string[] = []

    if ((video.nsfwFlags & NSFWFlag.VIOLENT) === NSFWFlag.VIOLENT) {
      flags.push($localize`violence`)
    }

    if ((video.nsfwFlags & NSFWFlag.EXPLICIT_SEX) === NSFWFlag.EXPLICIT_SEX) {
      flags.push($localize`explicit sex`)
    }

    if (flags.length === 0) {
      return $localize`This video contains sensitive content`
    }

    return $localize`This video contains sensitive content: ${flags.join(' - ')}`
  }

  getHighestAvailablePrivacy (serverPrivacies: VideoConstant<VideoPrivacyType>[]) {
    // We do not add a password as this requires additional configuration.
    const order = [
      VideoPrivacy.PRIVATE,
      VideoPrivacy.INTERNAL,
      VideoPrivacy.UNLISTED,
      VideoPrivacy.PUBLIC
    ]

    for (const privacy of order) {
      if (serverPrivacies.find(p => p.id === privacy)) {
        return privacy
      }
    }

    throw new Error('No highest privacy available')
  }

  nsfwPolicyToParam (nsfwPolicy: NSFWPolicyType): BooleanBothQuery {
    return nsfwPolicy === 'do_not_list'
      ? 'false'
      : 'both'
  }

  // Choose if we display by default the account or the channel
  buildDefaultOwnerDisplayType (video: Video) {
    const accountName = video.account.name

    // If the video channel name is an UUID (not really displayable, we changed this behaviour in v1.0.0-beta.12)
    // Or has not been customized (default created channel display name)
    // -> Use the account name
    if (
      video.channel.displayName === `Default ${accountName} channel` ||
      video.channel.displayName === `Main ${accountName} channel` ||
      video.channel.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    ) {
      return 'account' as 'account'
    }

    return 'videoChannel' as 'videoChannel'
  }

  private setVideoRate (id: string, rateType: UserVideoRateType, videoPassword?: string) {
    const url = `${VideoService.BASE_VIDEO_URL}/${id}/rate`
    const body: UserVideoRateUpdate = {
      rating: rateType
    }
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    return this.authHttp
      .put(url, body, { headers })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
