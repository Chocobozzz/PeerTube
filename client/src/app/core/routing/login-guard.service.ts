import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  CanActivateChild,
  RouterStateSnapshot,
  CanActivate,
  Router
} from '@angular/router'

import { AuthService } from '../auth/auth.service'

@Injectable()
export class LoginGuard implements CanActivate, CanActivateChild {

  constructor (
    private router: Router,
    private auth: AuthService
  ) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (this.auth.isLoggedIn() === true) return true

    this.auth.redirectUrl = state.url

    this.router.navigate([ '/login' ])
    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
