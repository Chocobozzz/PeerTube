import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, ServerService } from '@app/core'
import { environment } from 'src/environments/environment'
import { HttpStatusCode, ResultList, UserExport, UserImport } from '@peertube/peertube-models'
import { forkJoin, of } from 'rxjs'
import { peertubeTranslate } from '@peertube/peertube-core-utils'

@Injectable()
export class UserImportExportService {
  static BASE_USER_EXPORTS_URL = environment.apiUrl + '/api/v1/users/'
  static BASE_USER_IMPORTS_URL = environment.apiUrl + '/api/v1/users/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private server: ServerService
  ) { }

  // ---------------------------------------------------------------------------

  listUserExports (options: {
    userId: number
  }) {
    const { userId } = options

    const url = UserImportExportService.BASE_USER_EXPORTS_URL + userId + '/exports'

    return this.authHttp.get<ResultList<UserExport>>(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  requestNewUserExport (options: {
    userId: number
    withVideoFiles: boolean
  }) {
    const { userId, withVideoFiles } = options

    const url = UserImportExportService.BASE_USER_EXPORTS_URL + userId + '/exports/request'

    return this.authHttp.post(url, { withVideoFiles })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteUserExport (options: {
    userId: number
    userExportId: number
  }) {
    const { userId, userExportId } = options

    const url = UserImportExportService.BASE_USER_EXPORTS_URL + userId + '/exports/' + userExportId

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  getLatestImport (options: {
    userId: number
  }) {
    const { userId } = options

    const url = UserImportExportService.BASE_USER_IMPORTS_URL + userId + '/imports/latest'

    return forkJoin([
      this.authHttp.get<UserImport>(url),
      this.server.getServerLocale()
    ]).pipe(
      map(([ latestImport, translations ]) => {
        latestImport.state.label = peertubeTranslate(latestImport.state.label, translations)

        return latestImport
      }),
      catchError(err => {
        if (err.status === HttpStatusCode.NOT_FOUND_404) return of(undefined)

        return this.restExtractor.handleError(err)
      })
    )
  }
}
