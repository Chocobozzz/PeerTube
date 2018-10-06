import { Component, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { GuardsCheckStart, NavigationEnd, Router } from '@angular/router'
import { AuthService, RedirectService, ServerService, ThemeService } from '@app/core'
import { is18nPath } from '../../../shared/models/i18n'
import { ScreenService } from '@app/shared/misc/screen.service'
import { skip, debounceTime } from 'rxjs/operators'
import { HotkeysService, Hotkey } from 'angular2-hotkeys'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { fromEvent } from 'rxjs'

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit {
  notificationOptions = {
    timeOut: 5000,
    lastOnBottom: true,
    clickToClose: true,
    maxLength: 0,
    maxStack: 7,
    showProgressBar: false,
    pauseOnHover: false,
    preventDuplicates: false,
    preventLastDuplicates: 'visible',
    rtl: false
  }

  isMenuDisplayed = true
  isMenuChangedByUser = false

  customCSS: SafeHtml

  constructor (
    private i18n: I18n,
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

    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        const pathname = window.location.pathname
        if (!pathname || pathname === '/' || is18nPath(pathname)) {
          this.redirectService.redirectToHomepage(true)
        }
      }
    })

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

    // Do not display menu on small screens
    if (this.screenService.isInSmallView()) {
      this.isMenuDisplayed = false
    }

    this.router.events.subscribe(
      e => {
        // User clicked on a link in the menu, change the page
        if (e instanceof GuardsCheckStart && this.screenService.isInSmallView()) {
          this.isMenuDisplayed = false
        }
      }
    )

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
}
