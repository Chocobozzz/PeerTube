import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot } from '@angular/router'
import { RedirectService } from './redirect.service'

@Injectable()
export class TrendingGuard implements CanActivate {

  constructor (private redirectService: RedirectService) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    this.redirectService.redirectToTrending()
    return false
  }
}
