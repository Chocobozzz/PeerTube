import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, UserService } from '@app/core'
import { ResultList, TokenSession } from '@peertube/peertube-models'
import { catchError } from 'rxjs/operators'

@Injectable()
export class TokenSessionService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  // ---------------------------------------------------------------------------

  list (options: {
    userId: number
  }) {
    const { userId } = options

    const url = UserService.BASE_USERS_URL + userId + '/token-sessions'

    return this.authHttp.get<ResultList<TokenSession>>(url)
      .pipe(
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  revoke (options: {
    userId: number
    sessionId: number
  }) {
    const { userId, sessionId } = options

    const url = UserService.BASE_USERS_URL + userId + '/token-sessions/' + sessionId + '/revoke'

    return this.authHttp.post(url, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
