import { Component, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Event, GuardsCheckStart, NavigationEnd, Router, Scroll } from '@angular/router'
import { AuthService, RedirectService, ServerService, ThemeService } from '@app/core'
import { is18nPath } from '../../../shared/models/i18n'
import { ScreenService } from '@app/shared/misc/screen.service'
import { debounceTime, filter, map, pairwise } from 'rxjs/operators'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { fromEvent } from 'rxjs'
import { PlatformLocation, ViewportScroller } from '@angular/common'
import { PluginService } from '@app/core/plugins/plugin.service'
import { HooksService } from '@app/core/plugins/hooks.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { POP_STATE_MODAL_DISMISS } from '@app/shared/misc/constants'
import { WelcomeModalComponent } from '@app/modal/welcome-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'
import { ServerConfig, UserRole } from '@shared/models'
import { User } from '@app/shared'
import { InstanceService } from '@app/shared/instance/instance.service'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit {
  @ViewChild('welcomeModal') welcomeModal: WelcomeModalComponent
  @ViewChild('instanceConfigWarningModal') instanceConfigWarningModal: InstanceConfigWarningModalComponent

  isMenuDisplayed = true
  isMenuChangedByUser = false

  customCSS: SafeHtml

  private serverConfig: ServerConfig

  constructor (
    private i18n: I18n,
    private viewportScroller: ViewportScroller,
    private router: Router,
    private authService: AuthService,
    private serverService: ServerService,
    private pluginService: PluginService,
    private instanceService: InstanceService,
    private domSanitizer: DomSanitizer,
    private redirectService: RedirectService,
    private screenService: ScreenService,
    private hotkeysService: HotkeysService,
    private themeService: ThemeService,
    private hooks: HooksService,
    private location: PlatformLocation,
    private modalService: NgbModal
  ) { }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  get defaultRoute () {
    return RedirectService.DEFAULT_ROUTE
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.loadPlugins()
    this.themeService.initialize()

    this.authService.loadClientCredentials()

    if (this.isUserLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.authService.refreshUserInformation()
    }

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

    this.location.onPopState(() => this.modalService.dismissAll(POP_STATE_MODAL_DISMISS))

    this.openModalsIfNeeded()
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

    const navigationEndEvent = eventsObs.pipe(filter((e: Event): e is NavigationEnd => e instanceof NavigationEnd))

    // When we add the a-state parameter, we don't want to alter the scroll
    navigationEndEvent.pipe(pairwise())
                      .subscribe(([ e1, e2 ]) => {
                        try {
                          resetScroll = false

                          const previousUrl = new URL(window.location.origin + e1.urlAfterRedirects)
                          const nextUrl = new URL(window.location.origin + e2.urlAfterRedirects)

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

    navigationEndEvent.subscribe(e => {
      this.hooks.runAction('action:router.navigation-end', 'common', { path: e.url })
    })

    eventsObs.pipe(
      filter((e: Event): e is GuardsCheckStart => e instanceof GuardsCheckStart),
      filter(() => this.screenService.isInSmallView())
    ).subscribe(() => this.isMenuDisplayed = false) // User clicked on a link in the menu, change the page
  }

  private injectJS () {
    // Inject JS
    this.serverService.getConfig()
        .subscribe(config => {
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
    this.serverService.configReloaded
        .subscribe(() => {
          const headStyle = document.querySelector('style.custom-css-style')
          if (headStyle) headStyle.parentNode.removeChild(headStyle)

          // We test customCSS if the admin removed the css
          if (this.customCSS || this.serverConfig.instance.customizations.css) {
            const styleTag = '<style>' + this.serverConfig.instance.customizations.css + '</style>'
            this.customCSS = this.domSanitizer.bypassSecurityTrustHtml(styleTag)
          }
        })
  }

  private async loadPlugins () {
    this.pluginService.initializePlugins()

    this.hooks.runAction('action:application.init', 'common')
  }

  private async openModalsIfNeeded () {
    this.authService.userInformationLoaded
        .pipe(
          map(() => this.authService.getUser()),
          filter(user => user.role === UserRole.ADMINISTRATOR)
        ).subscribe(user => setTimeout(() => this._openAdminModalsIfNeeded(user))) // setTimeout because of ngIf in template
  }

  private async _openAdminModalsIfNeeded (user: User) {
    if (user.noWelcomeModal !== true) return this.welcomeModal.show()

    if (user.noInstanceConfigWarningModal === true || !this.serverConfig.signup.allowed) return

    this.instanceService.getAbout()
      .subscribe(about => {
        if (
          this.serverConfig.instance.name.toLowerCase() === 'peertube' ||
          !about.instance.terms ||
          !about.instance.administrator ||
          !about.instance.maintenanceLifetime
        ) {
          this.instanceConfigWarningModal.show(about)
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
      }, undefined, this.i18n('Go to the discover videos page')),

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
      }, undefined, this.i18n('Go to the videos upload page'))
    ])
  }
}
