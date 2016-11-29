import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth';
import { AuthStatus } from '../../shared';

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html'
})
export class MenuComponent implements OnInit {
  isLoggedIn: boolean;

  constructor (
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true;
          console.log('Logged in.');
        } else if (status === AuthStatus.LoggedOut) {
          this.isLoggedIn = false;
          console.log('Logged out.');
        } else {
          console.error('Unknown auth status: ' + status);
        }
      }
    );
  }

  isUserAdmin() {
    return this.authService.isAdmin();
  }

  logout() {
    this.authService.logout();
    // Redirect to home page
    this.router.navigate(['/videos/list']);
  }
}
