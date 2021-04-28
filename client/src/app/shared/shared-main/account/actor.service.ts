import { Observable, ReplaySubject } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { Account as ServerAccount, VideoChannel as ServerVideoChannel } from '@shared/models'
import { environment } from '../../../../environments/environment'
import { Account } from './account.model'
import { VideoChannel } from '../video-channel/video-channel.model'

@Injectable()
export class ActorService {
  static BASE_ACTOR_API_URL = environment.apiUrl + '/api/v1/actors/'

  actorLoaded = new ReplaySubject<Account | VideoChannel>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getActor (actorName: string): Observable<Account | VideoChannel> {
    return this.authHttp.get<ServerAccount | ServerVideoChannel>(ActorService.BASE_ACTOR_API_URL + actorName)
                .pipe(
                  map(actorHash => {
                    const isAccount = /\/accounts\/.+/.test(actorHash.url)
                    const isVideoChannel = /\/video-channels\/.+/.test(actorHash.url)

                    if (isAccount) {
                      return new Account(actorHash)
                    }

                    if (isVideoChannel) {
                      return new VideoChannel(actorHash)
                    }
                  }),
                  tap(actor => this.actorLoaded.next(actor)),
                  catchError(res => this.restExtractor.handleError(res))
                )
  }
}
