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
  private static BASE_AUDIT_LOG_URL = environment.apiUrl + '/api/v1/server/audit-logs'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getLogs (options: {
    isAuditLog: boolean,
    startDate: string,
    level?: LogLevel,
    endDate?: string
  }): Observable<any[]> {
    const { isAuditLog, startDate } = options

    let params = new HttpParams()
    params = params.append('startDate', startDate)

    if (!isAuditLog) params = params.append('level', options.level)
    if (options.endDate) params.append('endDate', options.endDate)

    const path = isAuditLog
      ? LogsService.BASE_AUDIT_LOG_URL
      : LogsService.BASE_LOG_URL

    return this.authHttp.get<any[]>(path, { params })
               .pipe(
                 map(rows => rows.map(r => new LogRow(r))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
