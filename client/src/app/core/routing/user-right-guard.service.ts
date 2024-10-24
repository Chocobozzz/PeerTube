import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '../auth/auth.service'
import { RedirectService } from './redirect.service'

@Injectable()
export class UserRightGuard {

  constructor (
    private redirectService: RedirectService,
    private auth: AuthService
  ) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const user = this.auth.getUser()
    if (user) {
      const neededUserRight = route.data.userRight

      if (user.hasRight(neededUserRight)) return true
    }

    const err = new Error('') as any
    err.status = 403

    this.redirectService.replaceBy401(err)

    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
