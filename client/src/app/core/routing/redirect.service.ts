import * as debug from 'debug'
import { Injectable } from '@angular/core'
import { NavigationCancel, NavigationEnd, Router } from '@angular/router'
import { ServerService } from '../server'
import { SessionStorageService } from '../wrappers/storage.service'

const logger = debug('peertube:router:RedirectService')

@Injectable()
export class RedirectService {
  private static SESSION_STORAGE_LATEST_SESSION_URL_KEY = 'redirect-latest-session-url'

  // Default route could change according to the instance configuration
  static INIT_DEFAULT_ROUTE = '/videos/trending'
  static INIT_DEFAULT_TRENDING_ALGORITHM = 'most-viewed'

  private previousUrl: string
  private currentUrl: string

  private latestSessionUrl: string

  private redirectingToHomepage = false
  private defaultTrendingAlgorithm = RedirectService.INIT_DEFAULT_TRENDING_ALGORITHM
  private defaultRoute = RedirectService.INIT_DEFAULT_ROUTE

  constructor (
    private router: Router,
    private serverService: ServerService,
    private storage: SessionStorageService
  ) {
    // The config is first loaded from the cache so try to get the default route
    const config = this.serverService.getHTMLConfig()
    if (config?.instance?.defaultClientRoute) {
      this.defaultRoute = config.instance.defaultClientRoute
    }
    if (config?.trending?.videos?.algorithms?.default) {
      this.defaultTrendingAlgorithm = config.trending.videos.algorithms.default
    }

    this.latestSessionUrl = this.storage.getItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY)
    this.storage.removeItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY)

    logger('Loaded latest session URL %s', this.latestSessionUrl)

    // Track previous url
    this.currentUrl = this.router.url
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
        if ([ '/401', '/404' ].includes(event.url)) return

        this.previousUrl = this.currentUrl
        this.currentUrl = event.url

        logger('Previous URL is %s, current URL is %s', this.previousUrl, this.currentUrl)
        logger('Setting %s as latest URL in session storage.', this.currentUrl)

        this.storage.setItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY, this.currentUrl)
      }
    })
  }

  getDefaultRoute () {
    return this.defaultRoute
  }

  getDefaultTrendingAlgorithm () {
    return this.defaultTrendingAlgorithm
  }

  redirectToLatestSessionRoute () {
    return this.doRedirect(this.latestSessionUrl)
  }

  redirectToPreviousRoute (fallbackRoute?: string) {
    return this.doRedirect(this.previousUrl, fallbackRoute)
  }

  getPreviousUrl () {
    return this.previousUrl
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

  private doRedirect (redirectUrl: string, fallbackRoute?: string) {
    logger('Redirecting on %s', redirectUrl)

    if (this.isValidRedirection(redirectUrl)) {
      return this.router.navigateByUrl(redirectUrl)
    }

    logger('%s is not a valid redirection, try fallback route %s', redirectUrl, fallbackRoute)
    if (fallbackRoute) {
      return this.router.navigateByUrl(fallbackRoute)
    }

    logger('There was no fallback route, redirecting to homepage')
    return this.redirectToHomepage()
  }

  private isValidRedirection (redirectUrl: string) {
    const exceptions = [
      '/verify-account',
      '/reset-password',
      '/login'
    ]

    if (!redirectUrl || redirectUrl === '/') return false

    return exceptions.every(e => !redirectUrl.startsWith(e))
  }
}
