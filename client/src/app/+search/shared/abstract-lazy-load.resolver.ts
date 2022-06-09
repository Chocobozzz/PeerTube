import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router'
import { ResultList } from '@shared/models'

export abstract class AbstractLazyLoadResolver <T> implements Resolve<any> {
  protected router: Router

  resolve (route: ActivatedRouteSnapshot) {
    const url = route.params.url

    if (!url) {
      console.error('Could not find url param.', { params: route.params })
      return this.router.navigateByUrl('/404')
    }

    return this.finder(url)
      .pipe(
        map(result => {
          if (result.data.length !== 1) {
            console.error('Cannot find result for this URL')
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
