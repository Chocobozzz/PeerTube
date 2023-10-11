import { delay, forkJoin } from 'rxjs'
import { filter, first, map } from 'rxjs/operators'
import { DOCUMENT, getLocaleDirection, PlatformLocation } from '@angular/common'
import { AfterViewInit, Component, Inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Event, GuardsCheckStart, RouteConfigLoadEnd, RouteConfigLoadStart, Router } from '@angular/router'
import {
  AuthService,
  MarkdownService,
  PeerTubeRouterService,
  RedirectService,
  ScreenService,
  ScrollService,
  ServerService,
  ThemeService,
  User,
  UserLocalStorageService,
  Hotkey,
  HotkeysService
} from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { AccountSetupWarningModalComponent } from '@app/modal/account-setup-warning-modal.component'
import { AdminWelcomeModalComponent } from '@app/modal/admin-welcome-modal.component'
import { CustomModalComponent } from '@app/modal/custom-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'
import { NgbConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { getShortLocale } from '@peertube/peertube-core-utils'
import { BroadcastMessageLevel, HTMLServerConfig, UserRole } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { MenuService } from './core/menu/menu.service'
import { POP_STATE_MODAL_DISMISS } from './helpers'
import { GlobalIconName } from './shared/shared-icons'
import { InstanceService } from './shared/shared-instance'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit, AfterViewInit {
  private static BROADCAST_MESSAGE_KEY = 'app-broadcast-message-dismissed'

  @ViewChild('accountSetupWarningModal') accountSetupWarningModal: AccountSetupWarningModalComponent
  @ViewChild('adminWelcomeModal') adminWelcomeModal: AdminWelcomeModalComponent
  @ViewChild('instanceConfigWarningModal') instanceConfigWarningModal: InstanceConfigWarningModalComponent
  @ViewChild('customModal') customModal: CustomModalComponent

  customCSS: SafeHtml
  broadcastMessage: { message: string, dismissable: boolean, class: string } | null = null
  hotkeysModalOpened = false

  private serverConfig: HTMLServerConfig

  constructor (
    @Inject(DOCUMENT) private document: Document,
    @Inject(LOCALE_ID) private localeId: string,
    private router: Router,
    private authService: AuthService,
    private serverService: ServerService,
    private peertubeRouter: PeerTubeRouterService,
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
    private scrollService: ScrollService,
    private userLocalStorage: UserLocalStorageService,
    public menu: MenuService
  ) {
    this.ngbConfig.animation = false
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    this.loadUser()

    this.serverConfig = this.serverService.getHTMLConfig()

    this.hooks.runAction('action:application.init', 'common')
    this.themeService.initialize()

    this.authService.loadClientCredentials()

    if (this.isUserLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.authService.refreshUserInformation()
    }

    this.initRouteEvents()
    this.scrollService.enableScrollRestoration()

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

  // ---------------------------------------------------------------------------

  getDefaultRoute () {
    return this.redirectService.getDefaultRoute().split('?')[0]
  }

  getDefaultRouteQuery () {
    return this.router.parseUrl(this.redirectService.getDefaultRoute()).queryParams
  }

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  getNotificationIcon (message: { severity: 'success' | 'error' | 'info' }): GlobalIconName {
    switch (message.severity) {
      case 'error':
        return 'cross'

      case 'success':
        return 'tick'

      case 'info':
        return 'help'
    }
  }

  getNotificationRole (message: { severity: 'success' | 'error' | 'info' }) {
    switch (message.severity) {
      case 'error':
        return 'alert'

      default:
        return 'status'
    }
  }

  // ---------------------------------------------------------------------------

  private initRouteEvents () {
    const eventsObs = this.router.events

    // Plugin hooks
    this.peertubeRouter.getNavigationEndEvents().subscribe(e => {
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

      const root = document.createElement('div')
      root.innerHTML = await this.markdownService.markdownToUnsafeHTML({ markdown: messageConfig.message })
      // Use alert-link class on links since there will be in an alert block
      root.querySelectorAll('a').forEach(a => a.className += ' alert-link')

      this.broadcastMessage = {
        message: root.innerHTML,
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
        /* eslint-disable no-eval */
        eval(this.serverConfig.instance.customizations.javascript)
      } catch (err) {
        logger.error('Cannot eval custom JavaScript.', err)
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

  private openModalsIfNeeded () {
    const userSub = this.authService.userInformationLoaded
        .pipe(
          delay(0), // Wait for modals creations
          map(() => this.authService.getUser())
        )

    // Admin modal
    userSub.pipe(
      filter(user => user.role.id === UserRole.ADMINISTRATOR)
    ).subscribe(user => this.openAdminModalsIfNeeded(user))

    // Account modal
    userSub.pipe(
      filter(user => user.role.id !== UserRole.ADMINISTRATOR)
    ).subscribe(user => this.openAccountModalsIfNeeded(user))
  }

  private openAdminModalsIfNeeded (user: User) {
    if (this.adminWelcomeModal.shouldOpen(user)) {
      return this.adminWelcomeModal.show()
    }

    if (!this.instanceConfigWarningModal.shouldOpenByUser(user)) return

    forkJoin([
      this.serverService.getConfig().pipe(first()),
      this.instanceService.getAbout().pipe(first())
    ]).subscribe(([ config, about ]) => {
      if (this.instanceConfigWarningModal.shouldOpen(config, about)) {
        this.instanceConfigWarningModal.show(about)
      }
    })
  }

  private openAccountModalsIfNeeded (user: User) {
    if (this.accountSetupWarningModal.shouldOpen(user)) {
      this.accountSetupWarningModal.show(user)
    }
  }

  // ---------------------------------------------------------------------------

  private initHotkeys () {
    this.hotkeysService.add([
      new Hotkey([ 'Shift+/', 's' ], () => {
        document.getElementById('search-video').focus()
        return false
      }, $localize`Focus the search bar`),

      new Hotkey('b', () => {
        this.menu.toggleMenu()
        return false
      }, $localize`Toggle the left menu`),

      new Hotkey('g o', () => {
        this.router.navigate([ '/videos/overview' ])
        return false
      }, $localize`Go to the discover videos page`),

      new Hotkey('g t', () => {
        this.router.navigate([ '/videos/trending' ])
        return false
      }, $localize`Go to the trending videos page`),

      new Hotkey('g r', () => {
        this.router.navigate([ '/videos/recently-added' ])
        return false
      }, $localize`Go to the recently added videos page`),

      new Hotkey('g l', () => {
        this.router.navigate([ '/videos/local' ])
        return false
      }, $localize`Go to the local videos page`),

      new Hotkey('g u', () => {
        this.router.navigate([ '/videos/upload' ])
        return false
      }, $localize`Go to the videos upload page`)
    ])
  }

  onHotkeysModalStateChange (opened: boolean) {
    this.hotkeysModalOpened = opened
  }

  // ---------------------------------------------------------------------------

  private loadUser () {
    const tokens = this.userLocalStorage.getTokens()
    if (!tokens) return

    const user = this.userLocalStorage.getLoggedInUser()
    if (!user) return

    // Initialize user
    this.authService.buildAuthUser(user, tokens)
  }
}
