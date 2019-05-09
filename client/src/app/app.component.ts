import { Component, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Event, GuardsCheckStart, NavigationEnd, Router, Scroll } from '@angular/router'
import { AuthService, RedirectService, ServerService, ThemeService } from '@app/core'
import { is18nPath } from '../../../shared/models/i18n'
import { ScreenService } from '@app/shared/misc/screen.service'
import { debounceTime, filter, map, pairwise, skip } from 'rxjs/operators'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { fromEvent } from 'rxjs'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit {
  isMenuDisplayed = true
  isMenuChangedByUser = false

  customCSS: SafeHtml

  constructor (
    private i18n: I18n,
    private viewportScroller: ViewportScroller,
    private router: Router,
    private authService: AuthService,
    private serverService: ServerService,
    private domSanitizer: DomSanitizer,
    private redirectService: RedirectService,
    private screenService: ScreenService,
    private hotkeysService: HotkeysService,
    private themeService: ThemeService
  ) { }

  get serverVersion () {
    return this.serverService.getConfig().serverVersion
  }

  get serverCommit () {
    const commit = this.serverService.getConfig().serverCommit || ''
    return (commit !== '') ? '...' + commit : commit
  }

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  get defaultRoute () {
    return RedirectService.DEFAULT_ROUTE
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    this.authService.loadClientCredentials()

    if (this.isUserLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.authService.refreshUserInformation()
    }

    // Load custom data from server
    this.serverService.loadConfig()
    this.serverService.loadVideoCategories()
    this.serverService.loadVideoLanguages()
    this.serverService.loadVideoLicences()
    this.serverService.loadVideoPrivacies()
    this.serverService.loadVideoPlaylistPrivacies()

    // Do not display menu on small screens
    if (this.screenService.isInSmallView()) {
      this.isMenuDisplayed = false
    }

    this.initRouteEvents()
    this.injectJS()
    this.injectCSS()

    this.initHotkeys()

    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.onResize())
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  toggleMenu () {
    this.isMenuDisplayed = !this.isMenuDisplayed
    this.isMenuChangedByUser = true
  }

  onResize () {
    this.isMenuDisplayed = window.innerWidth >= 800 && !this.isMenuChangedByUser
  }

  private initRouteEvents () {
    let resetScroll = true
    const eventsObs = this.router.events

    const scrollEvent = eventsObs.pipe(filter((e: Event): e is Scroll => e instanceof Scroll))
    const navigationEndEvent = eventsObs.pipe(filter((e: Event): e is NavigationEnd => e instanceof NavigationEnd))

    scrollEvent.subscribe(e => {
      if (e.position) {
        return this.viewportScroller.scrollToPosition(e.position)
      }

      if (e.anchor) {
        return this.viewportScroller.scrollToAnchor(e.anchor)
      }

      if (resetScroll) {
        return this.viewportScroller.scrollToPosition([ 0, 0 ])
      }
    })

    // When we add the a-state parameter, we don't want to alter the scroll
    navigationEndEvent.pipe(pairwise())
                      .subscribe(([ e1, e2 ]) => {
                        try {
                          resetScroll = false

                          const previousUrl = new URL(window.location.origin + e1.url)
                          const nextUrl = new URL(window.location.origin + e2.url)

                          if (previousUrl.pathname !== nextUrl.pathname) {
                            resetScroll = true
                            return
                          }

                          const nextSearchParams = nextUrl.searchParams
                          nextSearchParams.delete('a-state')

                          const previousSearchParams = previousUrl.searchParams

                          nextSearchParams.sort()
                          previousSearchParams.sort()

                          if (nextSearchParams.toString() !== previousSearchParams.toString()) {
                            resetScroll = true
                          }
                        } catch (e) {
                          console.error('Cannot parse URL to check next scroll.', e)
                          resetScroll = true
                        }
                      })

    navigationEndEvent.pipe(
      map(() => window.location.pathname),
      filter(pathname => !pathname || pathname === '/' || is18nPath(pathname))
    ).subscribe(() => this.redirectService.redirectToHomepage(true))

    eventsObs.pipe(
      filter((e: Event): e is GuardsCheckStart => e instanceof GuardsCheckStart),
      filter(() => this.screenService.isInSmallView())
    ).subscribe(() => this.isMenuDisplayed = false) // User clicked on a link in the menu, change the page
  }

  private injectJS () {
    // Inject JS
    this.serverService.configLoaded
        .subscribe(() => {
          const config = this.serverService.getConfig()

          if (config.instance.customizations.javascript) {
            try {
              // tslint:disable:no-eval
              eval(config.instance.customizations.javascript)
            } catch (err) {
              console.error('Cannot eval custom JavaScript.', err)
            }
          }
        })
  }

  private injectCSS () {
    // Inject CSS if modified (admin config settings)
    this.serverService.configLoaded
        .pipe(skip(1)) // We only want to subscribe to reloads, because the CSS is already injected by the server
        .subscribe(() => {
          const headStyle = document.querySelector('style.custom-css-style')
          if (headStyle) headStyle.parentNode.removeChild(headStyle)

          const config = this.serverService.getConfig()

          // We test customCSS if the admin removed the css
          if (this.customCSS || config.instance.customizations.css) {
            const styleTag = '<style>' + config.instance.customizations.css + '</style>'
            this.customCSS = this.domSanitizer.bypassSecurityTrustHtml(styleTag)
          }
        })
  }

  private initHotkeys () {
    this.hotkeysService.add([
      new Hotkey(['/', 's'], (event: KeyboardEvent): boolean => {
        document.getElementById('search-video').focus()
        return false
      }, undefined, this.i18n('Focus the search bar')),
      new Hotkey('b', (event: KeyboardEvent): boolean => {
        this.toggleMenu()
        return false
      }, undefined, this.i18n('Toggle the left menu')),
      new Hotkey('g o', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/overview' ])
        return false
      }, undefined, this.i18n('Go to the videos overview page')),
      new Hotkey('g t', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/trending' ])
        return false
      }, undefined, this.i18n('Go to the trending videos page')),
      new Hotkey('g r', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/recently-added' ])
        return false
      }, undefined, this.i18n('Go to the recently added videos page')),
      new Hotkey('g l', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/local' ])
        return false
      }, undefined, this.i18n('Go to the local videos page')),
      new Hotkey('g u', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/upload' ])
        return false
      }, undefined, this.i18n('Go to the videos upload page')),
      new Hotkey('shift+t', (event: KeyboardEvent): boolean => {
        this.themeService.toggleDarkTheme()
        return false
      }, undefined, this.i18n('Toggle Dark theme'))
    ])
  }
}
