import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  CanActivateChild,
  RouterStateSnapshot,
  CanActivate,
  Router
} from '@angular/router'

import { AuthService } from '../auth'

@Injectable()
export class UserRightGuard implements CanActivate, CanActivateChild {

  constructor (
    private router: Router,
    private auth: AuthService
  ) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const user = this.auth.getUser()
    if (user) {
      const neededUserRight = route.data.userRight

      if (user.hasRight(neededUserRight)) return true
    }

    this.router.navigate([ '/login' ])
    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
