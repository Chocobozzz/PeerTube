import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { BulkRemoveCommentsOfBody } from '../../../../../shared'
import { catchError } from 'rxjs/operators'

@Injectable()
export class BulkService {
  static BASE_BULK_URL = environment.apiUrl + '/api/v1/bulk'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  removeCommentsOf (body: BulkRemoveCommentsOfBody) {
    const url = BulkService.BASE_BULK_URL + '/remove-comments-of'

    return this.authHttp.post(url, body)
                        .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
