import { Route, PreloadingStrategy } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/switchMap';

export class PreloadSelectedModulesList implements PreloadingStrategy {
  preload(route: Route, load: Function): Observable<any> {
    if (!route.data || !route.data.preload) return Observable.of(null);

    if (typeof route.data.preload === 'number') {
      return Observable.timer(route.data.preload).switchMap(() => load());
    }

    return load();
  }
}
