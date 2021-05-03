import { Observable, ReplaySubject } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { Account as ServerAccount, VideoChannel as ServerVideoChannel } from '@shared/models'
import { environment } from '../../../../environments/environment'

type KeysOfUnion<T> = T extends T ? keyof T: never
type ServerActor = KeysOfUnion<ServerAccount | ServerVideoChannel>

@Injectable()
export class ActorService {
  static BASE_ACTOR_API_URL = environment.apiUrl + '/api/v1/actors/'

  actorLoaded = new ReplaySubject<string>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getActorType (actorName: string): Observable<string> {
    return this.authHttp.get<ServerActor>(ActorService.BASE_ACTOR_API_URL + actorName)
                .pipe(
                  map(actorHash => {
                    if (actorHash[ 'userId' ]) {
                      return 'Account'
                    }

                    return 'VideoChannel'
                  }),
                  tap(actor => this.actorLoaded.next(actor)),
                  catchError(res => this.restExtractor.handleError(res))
                )
  }
}
