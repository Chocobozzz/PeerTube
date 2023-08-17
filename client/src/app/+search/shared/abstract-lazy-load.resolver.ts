import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { logger } from '@root-helpers/logger'
import { ResultList } from '@peertube/peertube-models'

export abstract class AbstractLazyLoadResolver <T> {
  protected router: Router

  resolve (route: ActivatedRouteSnapshot) {
    const url = route.params.url

    if (!url) {
      logger.error('Could not find url param.', { params: route.params })
      return this.router.navigateByUrl('/404')
    }

    return this.finder(url)
      .pipe(
        map(result => {
          if (result.data.length !== 1) {
            logger.error('Cannot find result for this URL')
            return this.router.navigateByUrl('/404')
          }

          const redirectUrl = this.buildUrl(result.data[0])

          return this.router.navigateByUrl(redirectUrl)
        })
      )
  }

  protected abstract finder (url: string): Observable<ResultList<T>>
  protected abstract buildUrl (e: T): string
}
