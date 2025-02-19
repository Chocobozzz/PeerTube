import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { BulkRemoveCommentsOfBody } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'

@Injectable()
export class BulkService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  static BASE_BULK_URL = environment.apiUrl + '/api/v1/bulk'

  removeCommentsOf (body: BulkRemoveCommentsOfBody) {
    const url = BulkService.BASE_BULK_URL + '/remove-comments-of'

    return this.authHttp.post(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
