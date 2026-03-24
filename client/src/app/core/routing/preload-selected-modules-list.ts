import { Observable, of as ofObservable, timer as observableTimer } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { PreloadingStrategy, Route } from '@angular/router'

@Injectable()
export class PreloadSelectedModulesList implements PreloadingStrategy {
  preload (route: Route, load: () => Observable<any>): Observable<any> {
    if (!route.data?.preload) return ofObservable(null)

    if (typeof route.data.preload === 'number') {
      return observableTimer(route.data.preload)
        .pipe(switchMap(() => {
          // Not proud of this, but it allows to mark the route as preloaded so we don't display the loading indicator
          route.data.preloaded = true

          return load()
        }))
    }

    return load()
  }
}
