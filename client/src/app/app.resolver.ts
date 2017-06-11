import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';

@Injectable()
export class DataResolver implements Resolve<any> {
  public resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return Observable.of({ res: 'I am data'});
  }
}

/**
 * An array of services to resolve routes with data.
 */
export const APP_RESOLVER_PROVIDERS = [
  DataResolver
];
