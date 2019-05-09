import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared'
import { LogRow } from '@app/+admin/system/logs/log-row.model'
import { LogLevel } from '@shared/models/server/log-level.type'

@Injectable()
export class LogsService {
  private static BASE_LOG_URL = environment.apiUrl + '/api/v1/server/logs'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getLogs (level: LogLevel, startDate: string, endDate?: string): Observable<any[]> {
    let params = new HttpParams()
    params = params.append('startDate', startDate)
    params = params.append('level', level)

    if (endDate) params.append('endDate', endDate)

    return this.authHttp.get<any[]>(LogsService.BASE_LOG_URL, { params })
               .pipe(
                 map(rows => rows.map(r => new LogRow(r))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
