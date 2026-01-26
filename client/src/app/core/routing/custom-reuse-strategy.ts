import { ComponentRef, inject, Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router'
import debug from 'debug'
import { DisableForReuseHook } from './disable-for-reuse-hook'
import { RouterStatusService } from './router-status.service'

const debugLogger = debug('peertube:router:CustomReuseStrategy')

@Injectable()
export class CustomReuseStrategy implements RouteReuseStrategy {
  private routerStatus = inject(RouterStatusService)

  storedRouteHandles = new Map<string, DetachedRouteHandle>()
  recentlyUsed: string

  private readonly MAX_SIZE = 2

  // Decides if the route should be stored
  shouldDetach (route: ActivatedRouteSnapshot): boolean {
    return this.isReuseEnabled(route)
  }

  // Store the information for the route we're destructing
  store (route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    if (!handle) return

    const key = this.generateKey(route)
    this.recentlyUsed = key

    debugLogger(`Storing component ${key} to reuse later.`)

    const componentRef = (handle as any).componentRef as ComponentRef<DisableForReuseHook>
    componentRef.instance.disableForReuse()
    componentRef.changeDetectorRef.detectChanges()

    this.storedRouteHandles.set(key, handle)

    this.gb()
  }

  // Return true if we have a stored route object for the next route
  shouldAttach (route: ActivatedRouteSnapshot): boolean {
    const key = this.generateKey(route)
    const isNavigatingBack = this.routerStatus.isNavigatingBack

    const should = !!key && isNavigatingBack === true && this.isReuseEnabled(route) && this.storedRouteHandles.has(key)

    if (key) debugLogger(`Should attach ${key}? Answer: ${should}`, { isNavigatingBack })

    return should
  }

  // If we returned true in shouldAttach(), now return the actual route data for restoration
  retrieve (route: ActivatedRouteSnapshot): DetachedRouteHandle {
    if (!this.isReuseEnabled(route)) return undefined

    const key = this.generateKey(route)
    this.recentlyUsed = key

    debugLogger(`Reusing component ${key}.`)

    const handle = this.storedRouteHandles.get(key)
    if (!handle) return handle
    ;(handle as any).componentRef.instance.enabledForReuse()

    return handle
  }

  // Reuse the route if we're going to and from the same route
  shouldReuseRoute (future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig && future.routeConfig?.data?.reloadOnSameNavigation !== true
  }

  private gb () {
    if (this.storedRouteHandles.size >= this.MAX_SIZE) {
      this.storedRouteHandles.forEach((r, key) => {
        if (key === this.recentlyUsed) return

        debugLogger(`Removing stored component ${key}`)
        ;(r as any).componentRef.destroy()
        this.storedRouteHandles.delete(key)
      })
    }
  }

  private generateKey (route: ActivatedRouteSnapshot) {
    const reuse = route.data.reuse
    if (!reuse) return undefined

    return reuse.key + JSON.stringify(route.queryParams)
  }

  private isReuseEnabled (route: ActivatedRouteSnapshot) {
    // Cannot use peertube router here because of cyclic router dependency
    return route.data.reuse?.enabled
  }
}
