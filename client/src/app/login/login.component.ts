import { Component } from '@angular/core';
import { Router } from '@angular/router-deprecated';

import { AuthService, AuthStatus, User } from '../shared';

@Component({
  selector: 'my-login',
  template: require('./login.component.html')
})

export class LoginComponent {
  error: string = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(username: string, password: string) {
    this.authService.login(username, password).subscribe(
      result => {
        this.error = null;

        const user = new User(username, result);
        user.save();

        this.authService.setStatus(AuthStatus.LoggedIn);

        this.router.navigate(['VideosList']);
      },
      error => {
        if (error.error === 'invalid_grant') {
          this.error = 'Credentials are invalid.';
        } else {
          this.error = `${error.error}: ${error.error_description}`;
        }
      }
    );
  }
}
