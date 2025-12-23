import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { Debug, SendDebugCommand } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class DebugService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  private static BASE_DEBUG_URL = environment.apiUrl + '/api/v1/server/debug'

  getDebug (): Observable<Debug> {
    return this.authHttp.get<Debug>(DebugService.BASE_DEBUG_URL)
      .pipe(
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  testEmails (email: string) {
    const body: SendDebugCommand = {
      command: 'test-emails',
      email
    }

    return this.authHttp.post(DebugService.BASE_DEBUG_URL + '/run-command', body)
      .pipe(
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
