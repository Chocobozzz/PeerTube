import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestService } from '@app/core'
import { ServerLogLevel } from '@peertube/peertube-models'
import { catchError, map } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'
import { LogRow } from './log-row.model'

@Injectable()
export class LogsService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_LOG_URL = environment.apiUrl + '/api/v1/server/logs'
  private static BASE_AUDIT_LOG_URL = environment.apiUrl + '/api/v1/server/audit-logs'

  getLogs (options: {
    isAuditLog: boolean
    startDate: string
    tagsOneOf?: string[]
    level?: ServerLogLevel
    endDate?: string
  }) {
    const { isAuditLog, startDate, endDate, tagsOneOf } = options

    let params = new HttpParams()
    params = params.append('startDate', startDate)

    if (!isAuditLog) params = params.append('level', options.level)
    if (endDate) params = params.append('endDate', options.endDate)
    if (tagsOneOf) params = this.restService.addArrayParams(params, 'tagsOneOf', tagsOneOf)

    const path = isAuditLog
      ? LogsService.BASE_AUDIT_LOG_URL
      : LogsService.BASE_LOG_URL

    return this.authHttp.get<LogRow[]>(path, { params })
      .pipe(
        map(rows => rows.map(r => new LogRow(r))),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
