import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared'
import { Debug } from '@shared/models/server'

@Injectable()
export class DebugService {
  private static BASE_DEBUG_URL = environment.apiUrl + '/api/v1/server/debug'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getDebug (): Observable<Debug> {
    return this.authHttp.get<Debug>(DebugService.BASE_DEBUG_URL)
               .pipe(
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
