import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, ServerService } from './core'

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
    if (window.innerWidth < 600) {
      this.isMenuDisplayed = false
    }
  }

  isInAdmin () {
    return this.router.url.indexOf('/admin/') !== -1
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
