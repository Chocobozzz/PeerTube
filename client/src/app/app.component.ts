import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './core';
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

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      // The service will automatically redirect to the login page if the token is not valid anymore
      this.userService.checkTokenValidity();
    }
  }

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }
}
