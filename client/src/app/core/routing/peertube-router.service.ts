import { Injectable, inject } from '@angular/core'
import { ActivatedRoute, Event, NavigationEnd, Params, Router, Scroll } from '@angular/router'
import { filter } from 'rxjs/operators'
import { ServerService } from '../server'

export const enum RouterSetting {
  NONE = 0,
  DISABLE_SCROLL_RESTORE = 1 << 1
}

@Injectable()
export class PeerTubeRouterService {
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private server = inject(ServerService)

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

  // ---------------------------------------------------------------------------

  hasRouteSetting (setting: RouterSetting) {
    return !!(this.getRouteSetting() & setting)
  }

  silentNavigate (baseRoute: string[], existingParams: Params, relativeTo?: ActivatedRoute) {
    let routeSetting = this.getRouteSetting() ?? RouterSetting.NONE
    routeSetting |= RouterSetting.DISABLE_SCROLL_RESTORE

    return this.router.navigate(baseRoute, { queryParams: existingParams, relativeTo, state: { routeSetting } })
  }

  private getRouteSetting () {
    return this.router.getCurrentNavigation()?.extras?.state?.routeSetting as RouterSetting
  }
}
