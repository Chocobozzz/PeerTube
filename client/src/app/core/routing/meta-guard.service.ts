import { Injectable, inject } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'
import { MetaService } from './meta.service'

@Injectable()
export class MetaGuard {
  private meta = inject(MetaService)

  canActivate (route: ActivatedRouteSnapshot): boolean {
    const metaSettings = route.data?.meta

    if (metaSettings) {
      this.meta.update(metaSettings)
    }

    return true
  }

  canActivateChild (route: ActivatedRouteSnapshot): boolean {
    return this.canActivate(route)
  }
}
