import { bufferTime, catchError, filter, first, map, share, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { Observable, ReplaySubject, Subject } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel as VideoChannelServer } from '../../../../../shared/models/videos'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'

type SubscriptionExistResult = { [ uri: string ]: boolean }

@Injectable()
export class UserSubscriptionService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/users/me/subscriptions'

  // Use a replay subject because we "next" a value before subscribing
  private existsSubject: Subject<string> = new ReplaySubject(1)
  private readonly existsObservable: Observable<SubscriptionExistResult>

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {
    this.existsObservable = this.existsSubject.pipe(
      bufferTime(500),
      filter(uris => uris.length !== 0),
      switchMap(uris => this.doSubscriptionsExist(uris)),
      share()
    )
  }

  deleteSubscription (nameWithHost: string) {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/' + nameWithHost

    return this.authHttp.delete(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  addSubscription (nameWithHost: string) {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL

    const body = { uri: nameWithHost }
    return this.authHttp.post(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listSubscriptions (componentPagination: ComponentPagination): Observable<ResultList<VideoChannel>> {
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

  doesSubscriptionExist (nameWithHost: string) {
    this.existsSubject.next(nameWithHost)

    return this.existsObservable.pipe(first())
  }

  private doSubscriptionsExist (uris: string[]): Observable<SubscriptionExistResult> {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/exist'
    let params = new HttpParams()

    params = this.restService.addObjectParams(params, { uris })

    return this.authHttp.get<SubscriptionExistResult>(url, { params })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
