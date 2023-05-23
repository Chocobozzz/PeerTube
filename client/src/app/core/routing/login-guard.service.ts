import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '../auth/auth.service'
import { RedirectService } from './redirect.service'

@Injectable()
export class LoginGuard {

  constructor (
    private auth: AuthService,
    private redirectService: RedirectService
  ) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (this.auth.isLoggedIn() === true) return true

    this.redirectService.redirectToLogin()
    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
