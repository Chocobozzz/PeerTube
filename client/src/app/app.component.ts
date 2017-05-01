import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService, ConfigService } from './core';
import { VideoService } from './videos';
import { UserService } from './shared';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})
export class AppComponent implements OnInit {
  notificationOptions = {
    timeOut: 3000,
    lastOnBottom: true,
    clickToClose: true,
    maxLength: 0,
    maxStack: 7,
    showProgressBar: false,
    pauseOnHover: false,
    preventDuplicates: false,
    preventLastDuplicates: 'visible',
    rtl: false
  };

  isMenuDisplayed = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private configService: ConfigService,
    private userService: UserService,
    private videoService: VideoService,
    viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.userService.checkTokenValidity();
    }

    this.configService.loadConfig();
    this.videoService.loadVideoCategories();
    this.videoService.loadVideoLicences();
    this.videoService.loadVideoLanguages();

    // Do not display menu on small screens
    if (window.innerWidth < 600) {
      this.isMenuDisplayed = false;
    }
  }

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }

  toggleMenu() {
    this.isMenuDisplayed = !this.isMenuDisplayed;
  }

  getMainColClasses() {
    const colSizes = {
      md: 10,
      sm: 9,
      xs: 9
    };

    // Take all width is the menu is not displayed
    if (this.isMenuDisplayed === false) {
      Object.keys(colSizes).forEach(col => colSizes[col] = 12);
    }

    const classes = [ 'main-col' ];
    Object.keys(colSizes).forEach(col => classes.push(`col-${col}-${colSizes[col]}`));

    return classes;
  }
}
