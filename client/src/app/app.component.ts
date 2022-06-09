import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { filter, map, pairwise, switchMap } from 'rxjs/operators'
import { DOCUMENT, getLocaleDirection, PlatformLocation, ViewportScroller } from '@angular/common'
import { AfterViewInit, Component, Inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Event, GuardsCheckStart, NavigationEnd, RouteConfigLoadEnd, RouteConfigLoadStart, Router, Scroll } from '@angular/router'
import { AuthService, MarkdownService, RedirectService, ScreenService, ServerService, ThemeService, User } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { CustomModalComponent } from '@app/modal/custom-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'
import { WelcomeModalComponent } from '@app/modal/welcome-modal.component'
import { NgbConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { getShortLocale } from '@shared/core-utils/i18n'
import { BroadcastMessageLevel, HTMLServerConfig, ServerConfig, UserRole } from '@shared/models'
import { MenuService } from './core/menu/menu.service'
import { POP_STATE_MODAL_DISMISS } from './helpers'
import { InstanceService } from './shared/shared-instance'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit, AfterViewInit {
  private static BROADCAST_MESSAGE_KEY = 'app-broadcast-message-dismissed'

  @ViewChild('welcomeModal') welcomeModal: WelcomeModalComponent
  @ViewChild('instanceConfigWarningModal') instanceConfigWarningModal: InstanceConfigWarningModalComponent
  @ViewChild('customModal') customModal: CustomModalComponent

  customCSS: SafeHtml
  broadcastMessage: { message: string, dismissable: boolean, class: string } | null = null

  private serverConfig: HTMLServerConfig

  constructor (
    @Inject(DOCUMENT) private document: Document,
    @Inject(LOCALE_ID) private localeId: string,
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
    private modalService: NgbModal,
    private markdownService: MarkdownService,
    private ngbConfig: NgbConfig,
    private loadingBar: LoadingBarService,
    public menu: MenuService
  ) {
    this.ngbConfig.animation = false
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  goToDefaultRoute () {
    return this.router.navigateByUrl(this.redirectService.getDefaultRoute())
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    this.serverConfig = this.serverService.getHTMLConfig()

    this.hooks.runAction('action:application.init', 'common')
    this.themeService.initialize()

    this.authService.loadClientCredentials()

    if (this.isUserLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.authService.refreshUserInformation()
    }

    this.initRouteEvents()

    this.injectJS()
    this.injectCSS()
    this.injectBroadcastMessage()

    this.serverService.configReloaded
      .subscribe(config => {
        this.serverConfig = config

        this.injectBroadcastMessage()
        this.injectCSS()

        // Don't reinject JS since it could conflict with existing one
      })

    this.initHotkeys()

    this.location.onPopState(() => this.modalService.dismissAll(POP_STATE_MODAL_DISMISS))

    this.openModalsIfNeeded()

    this.document.documentElement.lang = getShortLocale(this.localeId)
    this.document.documentElement.dir = getLocaleDirection(this.localeId)
  }

  ngAfterViewInit () {
    this.pluginService.initializeCustomModal(this.customModal)
  }

  getToggleTitle () {
    if (this.menu.isDisplayed()) return $localize`Close the left menu`

    return $localize`Open the left menu`
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  hideBroadcastMessage () {
    peertubeLocalStorage.setItem(AppComponent.BROADCAST_MESSAGE_KEY, this.serverConfig.broadcastMessage.message)

    this.broadcastMessage = null
    this.screenService.isBroadcastMessageDisplayed = false
  }

  private initRouteEvents () {
    let resetScroll = true
    const eventsObs = this.router.events

    const scrollEvent = eventsObs.pipe(filter((e: Event): e is Scroll => e instanceof Scroll))

    // Handle anchors/restore position
    scrollEvent.subscribe(e => {
      // scrollToAnchor first to preserve anchor position when using history navigation
      if (e.anchor) {
        setTimeout(() => {
          this.viewportScroller.scrollToAnchor(e.anchor)
        })

        return
      }

      if (e.position) {
        return this.viewportScroller.scrollToPosition(e.position)
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

    // Plugin hooks
    navigationEndEvent.subscribe(e => {
      this.hooks.runAction('action:router.navigation-end', 'common', { path: e.url })
    })

    // Automatically hide/display the menu
    eventsObs.pipe(
      filter((e: Event): e is GuardsCheckStart => e instanceof GuardsCheckStart),
      filter(() => this.screenService.isInSmallView() || this.screenService.isInTouchScreen())
    ).subscribe(() => this.menu.setMenuDisplay(false)) // User clicked on a link in the menu, change the page

    // Handle lazy loaded module
    eventsObs.pipe(
      filter((e: Event): e is RouteConfigLoadStart => e instanceof RouteConfigLoadStart)
    ).subscribe(() => this.loadingBar.useRef().start())

    eventsObs.pipe(
      filter((e: Event): e is RouteConfigLoadEnd => e instanceof RouteConfigLoadEnd)
    ).subscribe(() => this.loadingBar.useRef().complete())
  }

  private async injectBroadcastMessage () {
    this.broadcastMessage = null
    this.screenService.isBroadcastMessageDisplayed = false

    const messageConfig = this.serverConfig.broadcastMessage

    if (messageConfig.enabled) {
      // Already dismissed this message?
      if (messageConfig.dismissable && localStorage.getItem(AppComponent.BROADCAST_MESSAGE_KEY) === messageConfig.message) {
        return
      }

      const classes: { [id in BroadcastMessageLevel]: string } = {
        info: 'alert-info',
        warning: 'alert-warning',
        error: 'alert-danger'
      }

      this.broadcastMessage = {
        message: await this.markdownService.unsafeMarkdownToHTML(messageConfig.message, true),
        dismissable: messageConfig.dismissable,
        class: classes[messageConfig.level]
      }

      this.screenService.isBroadcastMessageDisplayed = true
    }
  }

  private injectJS () {
    // Inject JS
    if (this.serverConfig.instance.customizations.javascript) {
      try {
        // tslint:disable:no-eval
        eval(this.serverConfig.instance.customizations.javascript)
      } catch (err) {
        console.error('Cannot eval custom JavaScript.', err)
      }
    }
  }

  private injectCSS () {
    const headStyle = document.querySelector('style.custom-css-style')
    if (headStyle) headStyle.parentNode.removeChild(headStyle)

    // We test customCSS if the admin removed the css
    if (this.customCSS || this.serverConfig.instance.customizations.css) {
      const styleTag = '<style>' + this.serverConfig.instance.customizations.css + '</style>'
      this.customCSS = this.domSanitizer.bypassSecurityTrustHtml(styleTag)
    }
  }

  private async openModalsIfNeeded () {
    this.authService.userInformationLoaded
        .pipe(
          map(() => this.authService.getUser()),
          filter(user => user.role === UserRole.ADMINISTRATOR),
          switchMap(user => {
            return this.serverService.getConfig()
              .pipe(map(serverConfig => ({ serverConfig, user })))
          })
        ).subscribe(({ serverConfig, user }) => this._openAdminModalsIfNeeded(serverConfig, user))
  }

  private async _openAdminModalsIfNeeded (serverConfig: ServerConfig, user: User) {
    if (user.noWelcomeModal !== true) return this.welcomeModal.show()

    if (user.noInstanceConfigWarningModal === true || !serverConfig.signup.allowed) return

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
      }, undefined, $localize`Focus the search bar`),

      new Hotkey('b', (event: KeyboardEvent): boolean => {
        this.menu.toggleMenu()
        return false
      }, undefined, $localize`Toggle the left menu`),

      new Hotkey('g o', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/overview' ])
        return false
      }, undefined, $localize`Go to the discover videos page`),

      new Hotkey('g t', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/trending' ])
        return false
      }, undefined, $localize`Go to the trending videos page`),

      new Hotkey('g r', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/recently-added' ])
        return false
      }, undefined, $localize`Go to the recently added videos page`),

      new Hotkey('g l', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/local' ])
        return false
      }, undefined, $localize`Go to the local videos page`),

      new Hotkey('g u', (event: KeyboardEvent): boolean => {
        this.router.navigate([ '/videos/upload' ])
        return false
      }, undefined, $localize`Go to the videos upload page`)
    ])
  }
}
