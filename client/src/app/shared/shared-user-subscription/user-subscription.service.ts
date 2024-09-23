import debug from 'debug'
import { merge, Observable, of, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService } from '@app/core'
import { buildBulkObservable } from '@app/helpers'
import { ActorFollow, ResultList, VideoChannel as VideoChannelServer, VideoSortField } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { Video } from '../shared-main/video/video.model'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { VideoService } from '../shared-main/video/video.service'
import { VideoChannelService } from '../shared-main/channel/video-channel.service'

const debugLogger = debug('peertube:subscriptions:UserSubscriptionService')

type SubscriptionExistResult = { [ uri: string ]: boolean }
type SubscriptionExistResultObservable = { [ uri: string ]: Observable<boolean> }

@Injectable()
export class UserSubscriptionService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/users/me/subscriptions'
  static BASE_VIDEO_CHANNELS_URL = environment.apiUrl + '/api/v1/video-channels'
  static BASE_ACCOUNTS_URL = environment.apiUrl + '/api/v1/accounts'

  // Use a replay subject because we "next" a value before subscribing
  private existsSubject = new ReplaySubject<string>(1)
  private readonly existsObservable: Observable<SubscriptionExistResult>

  private myAccountSubscriptionCache: SubscriptionExistResult = {}
  private myAccountSubscriptionCacheObservable: SubscriptionExistResultObservable = {}
  private myAccountSubscriptionCacheSubject = new Subject<SubscriptionExistResult>()

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private videoService: VideoService,
    private restService: RestService
  ) {
    this.existsObservable = merge(
      buildBulkObservable({
        time: 200,
        notifierObservable: this.existsSubject,
        bulkGet: this.doSubscriptionsExist.bind(this)
      }).pipe(map(r => r.response)),

      this.myAccountSubscriptionCacheSubject
    )
  }

  listFollowers (parameters: {
    pagination: ComponentPaginationLight
    nameWithHost: string
    search?: string
  }) {
    const { pagination, nameWithHost, search } = parameters

    let url = `${UserSubscriptionService.BASE_ACCOUNTS_URL}/${nameWithHost}/followers`

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, this.restService.componentToRestPagination(pagination), '-createdAt')

    if (search) {
      const filters = this.restService.parseQueryStringFilter(search, {
        channel: {
          prefix: 'channel:'
        }
      })

      if (filters.channel) {
        url = `${UserSubscriptionService.BASE_VIDEO_CHANNELS_URL}/${filters.channel}/followers`
      }

      params = this.restService.addObjectParams(params, { search: filters.search })
    }

    return this.authHttp
      .get<ResultList<ActorFollow>>(url, { params })
      .pipe(
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  getUserSubscriptionVideos (parameters: {
    videoPagination: ComponentPaginationLight
    sort: VideoSortField
    skipCount?: boolean
  }): Observable<ResultList<Video>> {
    const { videoPagination, sort, skipCount } = parameters
    const pagination = this.restService.componentToRestPagination(videoPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (skipCount) params = params.set('skipCount', skipCount + '')

    return this.authHttp
               .get<ResultList<Video>>(UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/videos', { params })
               .pipe(
                 switchMap(res => this.videoService.extractVideos(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  /**
   * Subscription part
   */

  deleteSubscription (nameWithHost: string) {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/' + nameWithHost

    return this.authHttp.delete(url)
               .pipe(
                 tap(() => {
                   this.myAccountSubscriptionCache[nameWithHost] = false

                   this.myAccountSubscriptionCacheSubject.next(this.myAccountSubscriptionCache)
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  addSubscription (nameWithHost: string) {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL

    const body = { uri: nameWithHost }
    return this.authHttp.post(url, body)
               .pipe(
                 tap(() => {
                   this.myAccountSubscriptionCache[nameWithHost] = true

                   this.myAccountSubscriptionCacheSubject.next(this.myAccountSubscriptionCache)
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listSubscriptions (parameters: {
    pagination: ComponentPaginationLight
    search: string
  }): Observable<ResultList<VideoChannel>> {
    const { pagination, search } = parameters
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL

    const restPagination = this.restService.componentToRestPagination(pagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, restPagination)
    if (search) params = params.append('search', search)

    return this.authHttp.get<ResultList<VideoChannelServer>>(url, { params })
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  /**
   * SubscriptionExist part
   */

  listenToMyAccountSubscriptionCacheSubject () {
    return this.myAccountSubscriptionCacheSubject.asObservable()
  }

  listenToSubscriptionCacheChange (nameWithHost: string) {
    if (nameWithHost in this.myAccountSubscriptionCacheObservable) {
      return this.myAccountSubscriptionCacheObservable[nameWithHost]
    }

    const obs = this.existsObservable
                    .pipe(
                      filter(existsResult => existsResult[nameWithHost] !== undefined),
                      map(existsResult => existsResult[nameWithHost])
                    )

    this.myAccountSubscriptionCacheObservable[nameWithHost] = obs
    return obs
  }

  doesSubscriptionExist (nameWithHost: string) {
    debugLogger('Running subscription check for ' + nameWithHost)

    if (nameWithHost in this.myAccountSubscriptionCache) {
      debugLogger('Found cache for ' + nameWithHost)

      return of(this.myAccountSubscriptionCache[nameWithHost])
    }

    this.existsSubject.next(nameWithHost)

    debugLogger('Fetching from network for ' + nameWithHost)
    return this.existsObservable.pipe(
      filter(existsResult => existsResult[nameWithHost] !== undefined),
      map(existsResult => existsResult[nameWithHost]),
      tap(result => this.myAccountSubscriptionCache[nameWithHost] = result)
    )
  }

  private doSubscriptionsExist (uris: string[]): Observable<SubscriptionExistResult> {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/exist'
    let params = new HttpParams()

    params = this.restService.addObjectParams(params, { uris })

    return this.authHttp.get<SubscriptionExistResult>(url, { params })
               .pipe(
                 tap(res => {
                   this.myAccountSubscriptionCache = {
                     ...this.myAccountSubscriptionCache,
                     ...res
                   }
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
