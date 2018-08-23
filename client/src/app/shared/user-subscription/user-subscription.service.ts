import { bufferTime, catchError, filter, map, share, switchMap, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { Observable, ReplaySubject, Subject } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel as VideoChannelServer } from '../../../../../shared/models/videos'

type SubscriptionExistResult = { [ uri: string ]: boolean }

@Injectable()
export class UserSubscriptionService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/users/me/subscriptions'

  // Use a replay subject because we "next" a value before subscribing
  private existsSubject: Subject<string> = new ReplaySubject(1)
  private existsObservable: Observable<SubscriptionExistResult>

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {
    this.existsObservable = this.existsSubject.pipe(
      tap(u => console.log(u)),
      bufferTime(500),
      filter(uris => uris.length !== 0),
      switchMap(uris => this.areSubscriptionExist(uris)),
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

  listSubscriptions (): Observable<ResultList<VideoChannel>> {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL

    return this.authHttp.get<ResultList<VideoChannelServer>>(url)
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  isSubscriptionExists (nameWithHost: string) {
    this.existsSubject.next(nameWithHost)

    return this.existsObservable
  }

  private areSubscriptionExist (uris: string[]): Observable<SubscriptionExistResult> {
    console.log(uris)
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/exist'
    let params = new HttpParams()

    params = this.restService.addObjectParams(params, { uris })

    return this.authHttp.get<SubscriptionExistResult>(url, { params })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
