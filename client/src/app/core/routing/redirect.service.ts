import { Injectable } from '@angular/core'
import { NavigationCancel, NavigationEnd, Router } from '@angular/router'
import { ServerService } from '../server'

@Injectable()
export class RedirectService {
  // Default route could change according to the instance configuration
  static INIT_DEFAULT_ROUTE = '/videos/trending'
  static INIT_DEFAULT_TRENDING_ALGORITHM = 'most-viewed'

  private previousUrl: string
  private currentUrl: string

  private redirectingToHomepage = false
  private defaultTrendingAlgorithm = RedirectService.INIT_DEFAULT_TRENDING_ALGORITHM
  private defaultRoute = RedirectService.INIT_DEFAULT_ROUTE

  constructor (
    private router: Router,
    private serverService: ServerService
  ) {
    // The config is first loaded from the cache so try to get the default route
    const config = this.serverService.getHTMLConfig()
    if (config?.instance?.defaultClientRoute) {
      this.defaultRoute = config.instance.defaultClientRoute
    }
    if (config?.trending?.videos?.algorithms?.default) {
      this.defaultTrendingAlgorithm = config.trending.videos.algorithms.default
    }

    // Track previous url
    this.currentUrl = this.router.url
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
        this.previousUrl = this.currentUrl
        this.currentUrl = event.url
      }
    })
  }

  getDefaultRoute () {
    return this.defaultRoute
  }

  getDefaultTrendingAlgorithm () {
    return this.defaultTrendingAlgorithm
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

    console.log('Redirecting to %s...', this.defaultRoute)

    this.router.navigateByUrl(this.defaultRoute, { skipLocationChange })
        .then(() => this.redirectingToHomepage = false)
        .catch(() => {
          this.redirectingToHomepage = false

          console.error(
            'Cannot navigate to %s, resetting default route to %s.',
            this.defaultRoute,
            RedirectService.INIT_DEFAULT_ROUTE
          )

          this.defaultRoute = RedirectService.INIT_DEFAULT_ROUTE
          return this.router.navigateByUrl(this.defaultRoute, { skipLocationChange })
        })

  }
}
