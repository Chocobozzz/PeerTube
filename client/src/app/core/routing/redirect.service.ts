import { Injectable } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { ServerService } from '../server'

@Injectable()
export class RedirectService {
  // Default route could change according to the instance configuration
  static INIT_DEFAULT_ROUTE = '/videos/trending'
  static DEFAULT_ROUTE = RedirectService.INIT_DEFAULT_ROUTE

  private previousUrl: string
  private currentUrl: string

  constructor (
    private router: Router,
    private serverService: ServerService
  ) {
    // The config is first loaded from the cache so try to get the default route
    const tmpConfig = this.serverService.getTmpConfig()
    if (tmpConfig && tmpConfig.instance && tmpConfig.instance.defaultClientRoute) {
      RedirectService.DEFAULT_ROUTE = tmpConfig.instance.defaultClientRoute
    }

    // Load default route
    this.serverService.getConfig()
        .subscribe(config => {
          const defaultRouteConfig = config.instance.defaultClientRoute

          if (defaultRouteConfig) {
            RedirectService.DEFAULT_ROUTE = defaultRouteConfig
          }
        })

    // Track previous url
    this.currentUrl = this.router.url
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.previousUrl = this.currentUrl
        this.currentUrl = event.url
      }
    })
  }

  redirectToPreviousRoute () {
    const exceptions = [
      '/verify-account',
      '/reset-password'
    ]

    if (this.previousUrl) {
      const isException = exceptions.find(e => this.previousUrl.startsWith(e))
      if (!isException) return this.router.navigateByUrl(this.previousUrl)
    }

    return this.redirectToHomepage()
  }

  redirectToHomepage (skipLocationChange = false) {
    console.log('Redirecting to %s...', RedirectService.DEFAULT_ROUTE)

    this.router.navigate([ RedirectService.DEFAULT_ROUTE ], { skipLocationChange })
        .catch(() => {
          console.error(
            'Cannot navigate to %s, resetting default route to %s.',
            RedirectService.DEFAULT_ROUTE,
            RedirectService.INIT_DEFAULT_ROUTE
          )

          RedirectService.DEFAULT_ROUTE = RedirectService.INIT_DEFAULT_ROUTE
          return this.router.navigate([ RedirectService.DEFAULT_ROUTE ], { skipLocationChange })
        })

  }
}
