import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot } from '@angular/router'

import { AuthService } from '../auth/auth.service'
import { ServerService } from '../server'
import { ServerConfig } from '@shared/models/server/server-config.model'

@Injectable()
export class PrivateGuard implements CanActivate, CanActivateChild {
  private config: ServerConfig

  constructor (
    private router: Router,
    private auth: AuthService,
    private server: ServerService
  ) {
    this.config = this.server.getConfig()
  }

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (this.config.instance.privateMode === true) {
      if (this.auth.isLoggedIn() === true) return true

      this.router.navigate([ '/login' ])
    }
    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state)
  }
}
