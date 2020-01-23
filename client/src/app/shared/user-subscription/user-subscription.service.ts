import { bufferTime, catchError, filter, map, observeOn, share, switchMap, tap } from 'rxjs/operators'
import { asyncScheduler, merge, Observable, of, ReplaySubject, Subject } from 'rxjs'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, NgZone } from '@angular/core'
import { ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel as VideoChannelServer } from '../../../../../shared/models/videos'
import { ComponentPaginationLight } from '@app/shared/rest/component-pagination.model'
import { uniq } from 'lodash-es'
import * as debug from 'debug'
import { enterZone, leaveZone } from '@app/shared/rxjs/zone'

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

  listSubscriptions (componentPagination: ComponentPaginationLight): Observable<ResultList<VideoChannel>> {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL

    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

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
