import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor } from '../rest'
import { Observable, of } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel as VideoChannelServer } from '../../../../../shared/models/videos'

@Injectable()
export class UserSubscriptionService {
  static BASE_USER_SUBSCRIPTIONS_URL = environment.apiUrl + '/api/v1/users/me/subscriptions'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {
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

  isSubscriptionExists (nameWithHost: string): Observable<boolean> {
    const url = UserSubscriptionService.BASE_USER_SUBSCRIPTIONS_URL + '/' + nameWithHost

    return this.authHttp.get(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => {
                   if (err.status === 404) return of(false)

                   return this.restExtractor.handleError(err)
                 })
               )
  }
}
