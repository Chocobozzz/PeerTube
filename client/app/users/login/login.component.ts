import { Component } from '@angular/core';
import { Router } from '@angular/router-deprecated';

import { AuthService, AuthStatus, User } from '../shared/index';

@Component({
  selector: 'my-user-login',
  styleUrls: [ 'client/app/users/login/login.component.css' ],
  templateUrl: 'client/app/users/login/login.component.html'
})

export class UserLoginComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(username: string, password: string) {
    this.authService.login(username, password).subscribe(
      result => {
        const user = new User(username, result);
        user.save();

        this.authService.setStatus(AuthStatus.LoggedIn);

        this.router.navigate(['VideosList']);
      },
      error => {
        if (error.error === 'invalid_grant') {
          alert('Credentials are invalid.');
        } else {
          alert(`${error.error}: ${error.error_description}`);
        }
      }
    );
  }
}
