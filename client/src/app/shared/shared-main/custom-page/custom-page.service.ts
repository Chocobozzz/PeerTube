import { of } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { CustomPage } from '@shared/models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class CustomPageService {
  static BASE_INSTANCE_HOMEPAGE_URL = environment.apiUrl + '/api/v1/custom-pages/homepage/instance'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) { }

  getInstanceHomepage () {
    return this.authHttp.get<CustomPage>(CustomPageService.BASE_INSTANCE_HOMEPAGE_URL)
                        .pipe(
                          catchError(err => {
                            if (err.status === 404) {
                              return of({ content: '' })
                            }

                            this.restExtractor.handleError(err)
                          })
                        )
  }

  updateInstanceHomepage (content: string) {
    return this.authHttp.put(CustomPageService.BASE_INSTANCE_HOMEPAGE_URL, { content })
      .pipe(
        map(this.restExtractor.extractDataBool),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
