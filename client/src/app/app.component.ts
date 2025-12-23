import { getLocaleDirection, NgClass, PlatformLocation } from '@angular/common'
import { AfterViewInit, Component, DOCUMENT, inject, LOCALE_ID, OnDestroy, OnInit, viewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Event, GuardsCheckStart, NavigationStart, RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterOutlet } from '@angular/router'
import {
  AuthService,
  Hotkey,
  HotkeysService,
  MarkdownService,
  PeerTubeRouterService,
  RouterStatusService,
  ScreenService,
  ScrollService,
  ServerService,
  User,
  UserLocalStorageService
} from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { AccountSetupWarningModalComponent } from '@app/modal/account-setup-warning-modal.component'
import { AdminConfigWizardModalComponent } from '@app/modal/admin-config-wizard/admin-config-wizard-modal.component'
import { CustomModalComponent } from '@app/modal/custom-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'
import { NgbConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarModule, LoadingBarService } from '@ngx-loading-bar/core'
import { getShortLocale } from '@peertube/peertube-core-utils'
import { BroadcastMessageLevel, HTMLServerConfig, UserRole } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { SharedModule } from 'primeng/api'
import { ToastModule } from 'primeng/toast'
import { forkJoin } from 'rxjs'
import { filter, first, map } from 'rxjs/operators'
import { MenuService } from './core/menu/menu.service'
import { HeaderComponent } from './header/header.component'
import { POP_STATE_MODAL_DISMISS } from './helpers'
import { HotkeysCheatSheetComponent } from './hotkeys/hotkeys-cheat-sheet.component'
import { MenuComponent } from './menu/menu.component'
import { ConfirmComponent } from './modal/confirm.component'
import { GlobalIconComponent, GlobalIconName } from './shared/shared-icons/global-icon.component'
import { InstanceService } from './shared/shared-main/instance/instance.service'
import { PeertubeModalService } from './shared/shared-main/peertube-modal/peertube-modal.service'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ],
  imports: [
    HotkeysCheatSheetComponent,
    NgClass,
    HeaderComponent,
    MenuComponent,
    GlobalIconComponent,
    RouterOutlet,
    LoadingBarModule,
    ConfirmComponent,
    ToastModule,
    SharedModule,
    AccountSetupWarningModalComponent,
    InstanceConfigWarningModalComponent,
    CustomModalComponent,
    AdminConfigWizardModalComponent
  ]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private document = inject<Document>(DOCUMENT)
  private localeId = inject(LOCALE_ID)
  private router = inject(Router)
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private peertubeRouter = inject(PeerTubeRouterService)
  private pluginService = inject(PluginService)
  private instanceService = inject(InstanceService)
  private domSanitizer = inject(DomSanitizer)
  private screenService = inject(ScreenService)
  private hotkeysService = inject(HotkeysService)
  private hooks = inject(HooksService)
  private location = inject(PlatformLocation)
  private modalService = inject(NgbModal)
  private markdownService = inject(MarkdownService)
  private ngbConfig = inject(NgbConfig)
  private loadingBar = inject(LoadingBarService)
  private scrollService = inject(ScrollService)
  private userLocalStorage = inject(UserLocalStorageService)
  private peertubeModal = inject(PeertubeModalService)
  private routerStatus = inject(RouterStatusService)

  menu = inject(MenuService)

  private static LS_BROADCAST_MESSAGE = 'app-broadcast-message-dismissed'

  readonly accountSetupWarningModal = viewChild<AccountSetupWarningModalComponent>('accountSetupWarningModal')
  readonly adminConfigWizardModal = viewChild<AdminConfigWizardModalComponent>('adminConfigWizardModal')
  readonly instanceConfigWarningModal = viewChild<InstanceConfigWarningModalComponent>('instanceConfigWarningModal')
  readonly customModal = viewChild<CustomModalComponent>('customModal')

  customCSS: SafeHtml
  broadcastMessage: { message: string, dismissable: boolean, class: string } | null = null
  hotkeysModalOpened = false

  private serverConfig: HTMLServerConfig
  private userLoaded = false

  constructor () {
    this.ngbConfig.animation = false
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    this.loadUser()

    this.serverConfig = this.serverService.getHTMLConfig()

    this.hooks.runAction('action:application.init', 'common')

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

    this.listenUserChangeForModals()

    this.document.documentElement.lang = getShortLocale(this.localeId)
    this.document.documentElement.dir = getLocaleDirection(this.localeId)

    this.pluginService.addAction('application:increment-loader', () => {
      this.loadingBar.useRef('plugins').start()

      return Promise.resolve()
    })
    this.pluginService.addAction('application:decrement-loader', () => {
      this.loadingBar.useRef('plugins').complete()

      return Promise.resolve()
    })

    this.peertubeModal.openAdminConfigWizardSubject.subscribe(({ showWelcome }) => {
      const adminWelcomeModal = this.adminConfigWizardModal()
      if (!adminWelcomeModal) return

      adminWelcomeModal.show({ showWelcome })
    })
  }

  ngAfterViewInit () {
    this.pluginService.initializeCustomModal(this.customModal())
  }

  ngOnDestroy () {
    this.pluginService.removeAction('application:increment-loader')
    this.pluginService.removeAction('application:decrement-loader')
  }

  // ---------------------------------------------------------------------------

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isUserAdmin () {
    return this.isUserLoggedIn() && this.authService.getUser().role.id === UserRole.ADMINISTRATOR
  }

  hideBroadcastMessage () {
    peertubeLocalStorage.setItem(AppComponent.LS_BROADCAST_MESSAGE, this.serverConfig.broadcastMessage.message)

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
    ).subscribe(() => this.menu.setMenuCollapsed(true)) // User clicked on a link in the menu, change the page

    // Handle lazy loaded module
    eventsObs.pipe(
      filter((e: Event): e is RouteConfigLoadStart => e instanceof RouteConfigLoadStart)
    ).subscribe(() => this.loadingBar.useRef().start())

    eventsObs.pipe(
      filter((e: Event): e is RouteConfigLoadEnd => e instanceof RouteConfigLoadEnd)
    ).subscribe(() => this.loadingBar.useRef().complete())

    // We need this to prevent circular dependency between the router and the custom reuse strategy
    eventsObs.pipe(
      filter((e: Event): e is NavigationStart => e instanceof NavigationStart)
    ).subscribe(() => {
      const current = this.router.currentNavigation()

      this.routerStatus.isNavigatingBack = current?.trigger === 'popstate' || current?.extras.state?.trigger === 'popstate'
    })
  }

  private async injectBroadcastMessage () {
    this.broadcastMessage = null
    this.screenService.isBroadcastMessageDisplayed = false

    const messageConfig = this.serverConfig.broadcastMessage

    if (messageConfig.enabled) {
      // Already dismissed this message?
      if (messageConfig.dismissable && localStorage.getItem(AppComponent.LS_BROADCAST_MESSAGE) === messageConfig.message) {
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
        window.eval(this.serverConfig.instance.customizations.javascript)
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

  private listenUserChangeForModals () {
    this.authService.userInformationLoaded
      .pipe(map(() => this.authService.getUser()))
      .subscribe(user => {
        this.userLoaded = true
        this.openModalsIfNeeded(user)
      })
  }

  onModalCreated () {
    const user = this.authService.getUser()
    if (!user) return

    setTimeout(() => this.openModalsIfNeeded(user))
  }

  private openModalsIfNeeded (user: User) {
    if (!this.userLoaded) return

    if (user.role.id === UserRole.ADMINISTRATOR) {
      this.openAdminModalsIfNeeded(user)
    } else {
      this.openAccountModalsIfNeeded(user)
    }
  }

  private openAdminModalsIfNeeded (user: User) {
    const adminWelcomeModal = this.adminConfigWizardModal()
    if (!adminWelcomeModal) return

    if (adminWelcomeModal.shouldAutoOpen(user)) {
      return adminWelcomeModal.show({ showWelcome: true })
    }

    const instanceConfigWarningModal = this.instanceConfigWarningModal()
    if (!instanceConfigWarningModal) return
    if (!instanceConfigWarningModal.canBeOpenByUser(user)) return

    forkJoin([
      this.serverService.getConfig().pipe(first()),
      this.instanceService.getAbout().pipe(first())
    ]).subscribe(([ config, about ]) => {
      const instanceConfigWarningModalValue = this.instanceConfigWarningModal()
      if (instanceConfigWarningModalValue.shouldAutoOpen(config, about)) {
        instanceConfigWarningModalValue.show(about)
      }
    })
  }

  private openAccountModalsIfNeeded (user: User) {
    const accountSetupWarningModal = this.accountSetupWarningModal()
    if (!accountSetupWarningModal) return

    if (accountSetupWarningModal.shouldAutoOpen(user)) {
      accountSetupWarningModal.show(user)
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
      }, $localize`Go to the "Discover videos" page`),

      new Hotkey('g v', () => {
        this.router.navigate([ '/videos/browse' ])
        return false
      }, $localize`Go to the "Browse videos" page`),

      new Hotkey('g u', () => {
        this.router.navigate([ '/videos/upload' ])
        return false
      }, $localize`Go to the "Publish video" page`)
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
