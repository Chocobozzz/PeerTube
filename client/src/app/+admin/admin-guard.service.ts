import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  CanActivateChild,
  RouterStateSnapshot,
  CanActivate
} from '@angular/router'

import { AuthService } from '../core'

@Injectable()
export class AdminGuard implements CanActivate, CanActivateChild {

  constructor (private auth: AuthService) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.auth.isAdmin()
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
