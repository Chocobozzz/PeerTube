import { Injectable, inject } from '@angular/core'
import { NavigationCancel, NavigationEnd, Router } from '@angular/router'
import { VideoSortField } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { PluginsManager } from '@root-helpers/plugins-manager'
import debug from 'debug'
import { environment } from 'src/environments/environment'
import { ServerService } from '../server'
import { SessionStorageService } from '../wrappers/storage.service'

const debugLogger = debug('peertube:router:RedirectService')

@Injectable()
export class RedirectService {
  private router = inject(Router)
  private serverService = inject(ServerService)
  private storage = inject(SessionStorageService)

  private static SESSION_STORAGE_LATEST_SESSION_URL_KEY = 'redirect-latest-session-url'

  // Default route could change according to the instance configuration
  static INIT_DEFAULT_ROUTE = '/videos/browse'
  static INIT_DEFAULT_TRENDING_ALGORITHM = 'most-viewed'

  private previousUrl: string
  private currentUrl: string

  private latestSessionUrl: string

  private redirectingToHomepage = false
  private defaultTrendingAlgorithm = RedirectService.INIT_DEFAULT_TRENDING_ALGORITHM
  private defaultRoute = RedirectService.INIT_DEFAULT_ROUTE

  init () {
    const config = this.serverService.getHTMLConfig()
    if (config.instance.defaultClientRoute) {
      this.defaultRoute = config.instance.defaultClientRoute
    }
    if (config.trending.videos.algorithms.default) {
      this.defaultTrendingAlgorithm = config.trending.videos.algorithms.default
    }

    this.latestSessionUrl = this.storage.getItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY)
    this.storage.removeItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY)

    debugLogger('Loaded latest session URL %s', this.latestSessionUrl)

    // Track previous url
    this.currentUrl = this.router.url
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
        if ([ '/401', '/404' ].includes(event.url)) return

        this.previousUrl = this.currentUrl
        this.currentUrl = event.url

        debugLogger('Previous URL is %s, current URL is %s', this.previousUrl, this.currentUrl)
        debugLogger('Setting %s as latest URL in session storage.', this.currentUrl)

        this.storage.setItem(RedirectService.SESSION_STORAGE_LATEST_SESSION_URL_KEY, this.currentUrl)
      }
    })
  }

  getDefaultRoute () {
    return this.defaultRoute.split('?')[0]
  }

  getDefaultRouteQuery () {
    return this.router.parseUrl(this.defaultRoute).queryParams
  }

  getDefaultTrendingSort () {
    const algorithm = this.defaultTrendingAlgorithm

    switch (algorithm) {
      case 'most-viewed':
        return '-trending'

      case 'most-liked':
        return '-likes'

      // We'll automatically apply "best" sort if using "hot" sort with a logged user
      case 'best':
        return '-hot'

      default:
        return '-' + algorithm as VideoSortField
    }
  }

  redirectToLatestSessionRoute (options: {
    reloadTab?: boolean
  } = {}) {
    return this.doRedirect(this.latestSessionUrl, options)
  }

  redirectToPreviousRoute (options: {
    reloadTab?: boolean
  } = {}) {
    return this.doRedirect(this.previousUrl, options)
  }

  getPreviousUrl () {
    return this.previousUrl
  }

  redirectToHomepage (options: {
    skipLocationChange?: boolean // default false
    reloadTab?: boolean // default false
  } = {}) {
    const { skipLocationChange = false, reloadTab = false } = options

    if (this.redirectingToHomepage) return

    if (reloadTab) {
      window.location.href = this.defaultRoute
      return
    }

    this.redirectingToHomepage = true

    logger.info(`Redirecting to default route ${this.defaultRoute}...`, { skipLocationChange })

    this.router.navigateByUrl(this.defaultRoute, {
      skipLocationChange,
      state: { trigger: this.router.currentNavigation()?.trigger }
    }).then(() => this.redirectingToHomepage = false)
      .catch(err => {
        this.redirectingToHomepage = false

        logger.error(`Cannot navigate to ${this.defaultRoute}, resetting default route to ${RedirectService.INIT_DEFAULT_ROUTE}`, err)

        this.defaultRoute = RedirectService.INIT_DEFAULT_ROUTE
        return this.router.navigateByUrl(this.defaultRoute, { skipLocationChange })
      })
  }

  redirectToLogin () {
    const externalLoginUrl = PluginsManager.getDefaultLoginHref(environment.apiUrl, this.serverService.getHTMLConfig())

    if (externalLoginUrl) window.location.href = externalLoginUrl
    else this.router.navigate([ '/login' ])
  }

  replaceBy401 (err: Error) {
    this.router.navigate([ '/401' ], { state: { obj: err }, skipLocationChange: true })
  }

  private doRedirect (redirectUrl: string, options: {
    reloadTab?: boolean
  } = {}) {
    const { reloadTab = false } = options

    debugLogger('Redirecting on %s', redirectUrl)

    if (this.isValidRedirection(redirectUrl)) {
      if (reloadTab) {
        window.location.href = redirectUrl
        return
      }

      return this.router.navigateByUrl(redirectUrl)
    }

    debugLogger(`${redirectUrl} is not a valid redirection, redirecting to homepage`)
    return this.redirectToHomepage(options)
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
