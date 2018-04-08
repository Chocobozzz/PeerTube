import { Component, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { GuardsCheckStart, Router } from '@angular/router'
import { AuthService, RedirectService, ServerService } from '@app/core'
import { isInSmallView } from '@app/shared/misc/utils'

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

  customCSS: SafeHtml

  constructor (
    private router: Router,
    private authService: AuthService,
    private serverService: ServerService,
    private domSanitizer: DomSanitizer,
    private redirectService: RedirectService
  ) {}

  get serverVersion () {
    return this.serverService.getConfig().serverVersion
  }

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  get defaultRoute () {
    return RedirectService.DEFAULT_ROUTE
  }

  ngOnInit () {
    document.getElementById('incompatible-browser').className += ' browser-ok'

    const pathname = window.location.pathname
    if (!pathname || pathname === '/') {
      this.redirectService.redirectToHomepage()
    }

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
    if (isInSmallView()) {
      this.isMenuDisplayed = false
    }

    this.router.events.subscribe(
      e => {
        // User clicked on a link in the menu, change the page
        if (e instanceof GuardsCheckStart && isInSmallView()) {
          this.isMenuDisplayed = false
        }
      }
    )

    this.serverService.configLoaded
      .subscribe(() => {
        const config = this.serverService.getConfig()

        // We test customCSS if the admin removed the css
        if (this.customCSS || config.instance.customizations.css) {
          const styleTag = '<style>' + config.instance.customizations.css + '</style>'
          this.customCSS = this.domSanitizer.bypassSecurityTrustHtml(styleTag)
        }

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

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  toggleMenu () {
    window.scrollTo(0, 0)
    this.isMenuDisplayed = !this.isMenuDisplayed
  }

  getMainColClasses () {
    // Take all width is the menu is not displayed
    if (this.isMenuDisplayed === false) return [ 'expanded' ]

    return []
  }
}
