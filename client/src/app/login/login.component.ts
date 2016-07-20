import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../shared';

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

        this.router.navigate(['/videos/list']);
      },
      error => {
        console.error(error);

        if (error.error === 'invalid_grant') {
          this.error = 'Credentials are invalid.';
        } else {
          this.error = `${error.error}: ${error.error_description}`;
        }
      }
    );
  }
}
