import { Injectable } from '@angular/core'
import { NavigationCancel, NavigationEnd, Router } from '@angular/router'
import { ServerService } from '../server'

@Injectable()
export class RedirectService {
  // Default route could change according to the instance configuration
  static INIT_DEFAULT_ROUTE = '/videos/trending'
  static DEFAULT_ROUTE = RedirectService.INIT_DEFAULT_ROUTE
  static INIT_DEFAULT_TRENDING_ALGORITHM = 'most-viewed'
  static DEFAULT_TRENDING_ALGORITHM = RedirectService.INIT_DEFAULT_TRENDING_ALGORITHM

  private previousUrl: string
  private currentUrl: string

  private redirectingToHomepage = false

  constructor (
    private router: Router,
    private serverService: ServerService
  ) {
    // The config is first loaded from the cache so try to get the default route
    const tmpConfig = this.serverService.getTmpConfig()
    if (tmpConfig?.instance?.defaultClientRoute) {
      RedirectService.DEFAULT_ROUTE = tmpConfig.instance.defaultClientRoute
    }
    if (tmpConfig?.trending?.videos?.algorithms?.default) {
      RedirectService.DEFAULT_TRENDING_ALGORITHM = tmpConfig.trending.videos.algorithms.default
    }

    // Load default route
    this.serverService.getConfig()
        .subscribe(config => {
          const defaultRouteConfig = config.instance.defaultClientRoute
          const defaultTrendingConfig = config.trending.videos.algorithms.default

          if (defaultRouteConfig) {
            RedirectService.DEFAULT_ROUTE = defaultRouteConfig
          }

          if (defaultTrendingConfig) {
            RedirectService.DEFAULT_TRENDING_ALGORITHM = defaultTrendingConfig
          }
        })

    // Track previous url
    this.currentUrl = this.router.url
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
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
    if (this.redirectingToHomepage) return

    this.redirectingToHomepage = true

    console.log('Redirecting to %s...', RedirectService.DEFAULT_ROUTE)

    this.router.navigateByUrl(RedirectService.DEFAULT_ROUTE, { skipLocationChange })
        .then(() => this.redirectingToHomepage = false)
        .catch(() => {
          this.redirectingToHomepage = false

          console.error(
            'Cannot navigate to %s, resetting default route to %s.',
            RedirectService.DEFAULT_ROUTE,
            RedirectService.INIT_DEFAULT_ROUTE
          )

          RedirectService.DEFAULT_ROUTE = RedirectService.INIT_DEFAULT_ROUTE
          return this.router.navigateByUrl(RedirectService.DEFAULT_ROUTE, { skipLocationChange })
        })

  }
}
