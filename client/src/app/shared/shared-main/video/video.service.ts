import { HttpClient, HttpParams, HttpRequest } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AuthService, ComponentPaginationLight, ConfirmService, RestExtractor, RestService, ServerService, UserService } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { arrayify } from '@peertube/peertube-core-utils'
import {
  BooleanBothQuery,
  FeedFormat,
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
  VideoFileMetadata,
  VideoIncludeType,
  VideoPrivacy,
  VideoPrivacyType,
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
import { VideoChannel } from '../video-channel/video-channel.model'
import { VideoChannelService } from '../video-channel/video-channel.service'
import { VideoDetails } from './video-details.model'
import { VideoEdit } from './video-edit.model'
import { VideoPasswordService } from './video-password.service'
import { Video } from './video.model'

export type CommonVideoParams = {
  videoPagination?: ComponentPaginationLight
  sort: VideoSortField | SortMeta
  include?: VideoIncludeType
  isLocal?: boolean
  categoryOneOf?: number[]
  languageOneOf?: string[]
  privacyOneOf?: VideoPrivacyType[]
  isLive?: boolean
  skipCount?: boolean
  nsfw?: BooleanBothQuery
}

@Injectable()
export class VideoService {
  static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos'
  static BASE_FEEDS_URL = environment.apiUrl + '/feeds/videos.'
  static PODCAST_FEEDS_URL = environment.apiUrl + '/feeds/podcast/videos.xml'
  static BASE_SUBSCRIPTION_FEEDS_URL = environment.apiUrl + '/feeds/subscriptions.'

  constructor (
    private auth: AuthService,
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private serverService: ServerService,
    private confirmService: ConfirmService
  ) {}

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
      videoPasswords: video.privacy === VideoPrivacy.PASSWORD_PROTECTED
        ? [ video.videoPassword ]
        : undefined,
      tags: video.tags,
      nsfw: video.nsfw,
      waitTranscoding: video.waitTranscoding,
      commentsPolicy: video.commentsPolicy,
      downloadEnabled: video.downloadEnabled,
      thumbnailfile: video.thumbnailfile,
      previewfile: video.previewfile,
      pluginData: video.pluginData,
      scheduleUpdate,
      originallyPublishedAt
    }

    const data = objectToFormData(body)

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${video.id}`, data)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  uploadVideo (video: FormData) {
    const req = new HttpRequest('POST', `${VideoService.BASE_VIDEO_URL}/upload`, video, { reportProgress: true })

    return this.authHttp
               .request<{ video: { id: number, uuid: string } }>(req)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getMyVideos (options: {
    videoPagination: ComponentPaginationLight
    sort: VideoSortField
    userChannels?: VideoChannelServerModel[]
    search?: string
  }): Observable<ResultList<Video>> {
    const { videoPagination, sort, userChannels = [], search } = options

    const pagination = this.restService.componentToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      const filters = this.restService.parseQueryStringFilter(search, {
        isLive: {
          prefix: 'isLive:',
          isBoolean: true
        },
        channelId: {
          prefix: 'channel:',
          handler: (name: string) => {
            const channel = userChannels.find(c => c.name === name)

            if (channel) return channel.id

            return undefined
          }
        }
      })

      params = this.restService.addObjectParams(params, filters)
    }

    return this.authHttp
               .get<ResultList<Video>>(UserService.BASE_USERS_URL + 'me/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getAccountVideos (parameters: CommonVideoParams & {
    account: Pick<Account, 'nameWithHost'>
    search?: string
  }): Observable<ResultList<Video>> {
    const { account, search } = parameters

    let params = new HttpParams()
    params = this.buildCommonVideosParams({ params, ...parameters })

    if (search) params = params.set('search', search)

    return this.authHttp
               .get<ResultList<Video>>(AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideoChannelVideos (parameters: CommonVideoParams & {
    videoChannel: Pick<VideoChannel, 'nameWithHost'>
  }): Observable<ResultList<Video>> {
    const { videoChannel } = parameters

    let params = new HttpParams()
    params = this.buildCommonVideosParams({ params, ...parameters })

    return this.authHttp
               .get<ResultList<Video>>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/videos', { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideos (parameters: CommonVideoParams): Observable<ResultList<Video>> {
    let params = new HttpParams()
    params = this.buildCommonVideosParams({ params, ...parameters })

    return this.authHttp
               .get<ResultList<Video>>(VideoService.BASE_VIDEO_URL, { params })
               .pipe(
                 switchMap(res => this.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  buildBaseFeedUrls (params: HttpParams, base = VideoService.BASE_FEEDS_URL) {
    const feeds = [
      {
        format: FeedFormat.RSS,
        label: 'media rss 2.0',
        url: base + FeedFormat.RSS.toLowerCase()
      },
      {
        format: FeedFormat.ATOM,
        label: 'atom 1.0',
        url: base + FeedFormat.ATOM.toLowerCase()
      },
      {
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
      format: FeedFormat.RSS,
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

  getVideoFileMetadata (metadataUrl: string) {
    return this.authHttp
               .get<VideoFileMetadata>(metadataUrl)
               .pipe(
                 catchError(err => this.restExtractor.handleError(err))
               )
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

  runTranscoding (options: {
    videos: Video[]
    type: 'hls' | 'web-video'
    askForForceTranscodingIfNeeded: boolean
    forceTranscoding?: boolean
  }): Observable<any> {
    const { videos, type, askForForceTranscodingIfNeeded, forceTranscoding } = options

    const body: VideoTranscodingCreate = { transcodingType: type, forceTranscoding }

    return from(videos)
      .pipe(
        concatMap(video => {
          return this.authHttp.post(VideoService.BASE_VIDEO_URL + '/' + video.uuid + '/transcoding', body)
            .pipe(
              catchError(err => {
                if (askForForceTranscodingIfNeeded && err.error?.code === ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCODED) {
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
                          askForForceTranscodingIfNeeded: false,
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

  loadCompleteDescription (descriptionPath: string) {
    return this.authHttp
               .get<{ description: string }>(environment.apiUrl + descriptionPath)
               .pipe(
                 map(res => res.description),
                 catchError(err => this.restExtractor.handleError(err))
               )
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

  explainedPrivacyLabels (serverPrivacies: VideoConstant<VideoPrivacyType>[], defaultPrivacyId: VideoPrivacyType = VideoPrivacy.PUBLIC) {
    const descriptions = {
      [VideoPrivacy.PRIVATE]: $localize`Only I can see this video`,
      [VideoPrivacy.UNLISTED]: $localize`Only shareable via a private link`,
      [VideoPrivacy.PUBLIC]: $localize`Anyone can see this video`,
      [VideoPrivacy.INTERNAL]: $localize`Only users of this instance can see this video`,
      [VideoPrivacy.PASSWORD_PROTECTED]: $localize`Only users with the appropriate password can see this video`
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

  buildCommonVideosParams (options: CommonVideoParams & { params: HttpParams }) {
    const {
      params,
      videoPagination,
      sort,
      isLocal,
      include,
      categoryOneOf,
      languageOneOf,
      privacyOneOf,
      skipCount,
      isLive,
      nsfw
    } = options

    const pagination = videoPagination
      ? this.restService.componentToRestPagination(videoPagination)
      : undefined

    let newParams = this.restService.addRestGetParams(params, pagination, this.buildListSort(sort))

    if (skipCount) newParams = newParams.set('skipCount', skipCount + '')

    if (isLocal !== undefined) newParams = newParams.set('isLocal', isLocal)
    if (include !== undefined) newParams = newParams.set('include', include)
    if (isLive !== undefined) newParams = newParams.set('isLive', isLive)
    if (nsfw !== undefined) newParams = newParams.set('nsfw', nsfw)
    if (languageOneOf !== undefined) newParams = this.restService.addArrayParams(newParams, 'languageOneOf', languageOneOf)
    if (categoryOneOf !== undefined) newParams = this.restService.addArrayParams(newParams, 'categoryOneOf', categoryOneOf)
    if (privacyOneOf !== undefined) newParams = this.restService.addArrayParams(newParams, 'privacyOneOf', privacyOneOf)

    return newParams
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
