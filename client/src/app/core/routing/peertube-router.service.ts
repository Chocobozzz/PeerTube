import { filter } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRoute, ActivatedRouteSnapshot, Event, NavigationEnd, Router, Scroll } from '@angular/router'
import { ServerService } from '../server'

export const enum RouterSetting {
  NONE = 0,
  REUSE_COMPONENT = 1 << 0,
  DISABLE_SCROLL_RESTORE = 1 << 1
}

@Injectable()
export class PeerTubeRouterService {
  static readonly ROUTE_SETTING_NAME = 's'

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private server: ServerService
  ) { }

  addRouteSetting (toAdd: RouterSetting) {
    if (this.hasRouteSetting(toAdd)) return

    const current = this.getRouteSetting()

    this.setRouteSetting(current | toAdd)
  }

  deleteRouteSetting (toDelete: RouterSetting) {
    const current = this.getRouteSetting()

    this.setRouteSetting(current & ~toDelete)
  }

  getRouteSetting (snapshot?: ActivatedRouteSnapshot) {
    return (snapshot || this.route.snapshot).queryParams[PeerTubeRouterService.ROUTE_SETTING_NAME]
  }

  setRouteSetting (value: number) {
    let path = window.location.pathname
    if (!path || path === '/') path = this.server.getHTMLConfig().instance.defaultClientRoute

    const queryParams = { [PeerTubeRouterService.ROUTE_SETTING_NAME]: value }

    this.router.navigate([ path ], { queryParams, replaceUrl: true, queryParamsHandling: 'merge' })
  }

  hasRouteSetting (setting: RouterSetting, snapshot?: ActivatedRouteSnapshot) {
    return !!(this.getRouteSetting(snapshot) & setting)
  }

  getNavigationEndEvents () {
    return this.router.events.pipe(
      filter((e: Event): e is NavigationEnd => e instanceof NavigationEnd)
    )
  }

  getScrollEvents () {
    return this.router.events.pipe(
      filter((e: Event): e is Scroll => e instanceof Scroll)
    )
  }

  silentNavigate (baseRoute: string[], queryParams: { [id: string]: string }) {
    let routeSetting = this.getRouteSetting() ?? RouterSetting.NONE
    routeSetting |= RouterSetting.DISABLE_SCROLL_RESTORE

    queryParams = {
      ...queryParams,

      [PeerTubeRouterService.ROUTE_SETTING_NAME]: routeSetting
    }

    return this.router.navigate(baseRoute, { queryParams })
  }

}
