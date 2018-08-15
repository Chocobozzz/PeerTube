import { Observable, timer as observableTimer, of as ofObservable } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { PreloadingStrategy, Route } from '@angular/router'

export class PreloadSelectedModulesList implements PreloadingStrategy {
  preload (route: Route, load: Function): Observable<any> {
    if (!route.data || !route.data.preload) return ofObservable(null)

    if (typeof route.data.preload === 'number') {
      return observableTimer(route.data.preload).pipe(switchMap(() => load()))
    }

    return load()
  }
}
