import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { AutomaticTagAvailable, CommentAutomaticTagPolicies } from '@peertube/peertube-models'
import { catchError } from 'rxjs/operators'
import { environment } from 'src/environments/environment'

@Injectable({ providedIn: 'root' })
export class AutomaticTagService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  private static BASE_AUTOMATIC_TAGS_URL = environment.apiUrl + '/api/v1/automatic-tags/'

  listAvailable (options: {
    accountName: string
  }) {
    const url = AutomaticTagService.BASE_AUTOMATIC_TAGS_URL + 'accounts/' + options.accountName + '/available'

    return this.authHttp.get<AutomaticTagAvailable>(url)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getCommentPolicies (options: {
    accountName: string
  }) {
    const url = AutomaticTagService.BASE_AUTOMATIC_TAGS_URL + 'policies/accounts/' + options.accountName + '/comments'

    return this.authHttp.get<CommentAutomaticTagPolicies>(url)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateCommentPolicies (options: {
    accountName: string
    review: string[]
  }) {
    const url = AutomaticTagService.BASE_AUTOMATIC_TAGS_URL + 'policies/accounts/' + options.accountName + '/comments'

    return this.authHttp.put(url, { review: options.review })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
