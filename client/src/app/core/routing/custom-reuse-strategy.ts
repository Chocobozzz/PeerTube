import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router'
import { Injectable } from '@angular/core'

@Injectable()
export class CustomReuseStrategy implements RouteReuseStrategy {
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

    console.log('Storing component %s to reuse later.', key);

    (handle as any).componentRef.instance.disableForReuse()

    this.storedRouteHandles.set(key, handle)

    this.gb()
  }

  // Return true if we have a stored route object for the next route
  shouldAttach (route: ActivatedRouteSnapshot): boolean {
    const key = this.generateKey(route)
    return this.isReuseEnabled(route) && this.storedRouteHandles.has(key)
  }

  // If we returned true in shouldAttach(), now return the actual route data for restoration
  retrieve (route: ActivatedRouteSnapshot): DetachedRouteHandle {
    if (!this.isReuseEnabled(route)) return undefined

    const key = this.generateKey(route)
    this.recentlyUsed = key

    console.log('Reusing component %s.', key)

    const handle = this.storedRouteHandles.get(key)
    if (!handle) return handle;

    (handle as any).componentRef.instance.enabledForReuse()

    return handle
  }

  // Reuse the route if we're going to and from the same route
  shouldReuseRoute (future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig
  }

  private gb () {
    if (this.storedRouteHandles.size >= this.MAX_SIZE) {
      this.storedRouteHandles.forEach((r, key) => {
        if (key === this.recentlyUsed) return

        console.log('Removing stored component %s.', key);

        (r as any).componentRef.destroy()
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
    return route.data.reuse && route.data.reuse.enabled && route.queryParams[ 'a-state' ]
  }
}
