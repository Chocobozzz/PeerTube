import * as debug from 'debug'
import { uniq } from 'lodash-es'
import { asyncScheduler, merge, Observable, of, ReplaySubject, Subject } from 'rxjs'
import { bufferTime, catchError, filter, map, observeOn, share, switchMap, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, NgZone } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService } from '@app/core'
import { enterZone, leaveZone } from '@app/helpers'
import { Video, VideoChannel, VideoChannelService, VideoService } from '@app/shared/shared-main'
import { ResultList, VideoChannel as VideoChannelServer, VideoSortField } from '@shared/models'
import { environment } from '../../../environments/environment'

const logger = debug('peertube:subscriptions:UserSubscriptionService')

type SubscriptionExistResult = { [ uri: string ]: boolean }
type SubscriptionExistResultObservable = { [ uri: string ]: Observable<boolean> }

@Injectable()
export class UserSubscriptionService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/users/me/subscriptions'

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
    private restService: RestService,
    private ngZone: NgZone
  ) {
    this.existsObservable = merge(
      this.existsSubject.pipe(
        // We leave Angular zone so Protractor does not get stuck
        bufferTime(500, leaveZone(this.ngZone, asyncScheduler)),
        filter(uris => uris.length !== 0),
        map(uris => uniq(uris)),
        observeOn(enterZone(this.ngZone, asyncScheduler)),
        switchMap(uris => this.doSubscriptionsExist(uris)),
        share()
      ),

      this.myAccountSubscriptionCacheSubject
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
                 map(this.restExtractor.extractDataBool),
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
                 map(this.restExtractor.extractDataBool),
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

    const restPagination = this.restService.componentPaginationToRestPagination(pagination)

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
      return this.myAccountSubscriptionCacheObservable[ nameWithHost ]
    }

    const obs = this.existsObservable
                    .pipe(
                      filter(existsResult => existsResult[ nameWithHost ] !== undefined),
                      map(existsResult => existsResult[ nameWithHost ])
                    )

    this.myAccountSubscriptionCacheObservable[ nameWithHost ] = obs
    return obs
  }

  doesSubscriptionExist (nameWithHost: string) {
    logger('Running subscription check for %d.', nameWithHost)

    if (nameWithHost in this.myAccountSubscriptionCache) {
      logger('Found cache for %d.', nameWithHost)

      return of(this.myAccountSubscriptionCache[ nameWithHost ])
    }

    this.existsSubject.next(nameWithHost)

    logger('Fetching from network for %d.', nameWithHost)
    return this.existsObservable.pipe(
      filter(existsResult => existsResult[ nameWithHost ] !== undefined),
      map(existsResult => existsResult[ nameWithHost ]),
      tap(result => this.myAccountSubscriptionCache[ nameWithHost ] = result)
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
