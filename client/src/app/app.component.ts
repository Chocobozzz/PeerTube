import { Component, OnInit } from '@angular/core'
import { GuardsCheckStart, NavigationEnd, Router } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { isInMobileView } from '@app/shared/misc/utils'

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

  constructor (
    private router: Router,
    private authService: AuthService,
    private serverService: ServerService
  ) {}

  get serverVersion () {
    return this.serverService.getConfig().serverVersion
  }

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  ngOnInit () {
    this.authService.loadClientCredentials()

    if (this.authService.isLoggedIn()) {
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
    if (isInMobileView()) {
      this.isMenuDisplayed = false
    }

    this.router.events.subscribe(
      e => {
        // User clicked on a link in the menu, change the page
        if (e instanceof GuardsCheckStart && isInMobileView()) {
          this.isMenuDisplayed = false
        }
      }
    )
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
