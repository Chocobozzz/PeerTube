import { Component } from '@angular/core';
import { Router } from '@angular/router-deprecated';

import { AuthService } from '../../services/auth.service';
import { AuthStatus } from '../../models/authStatus';
import { User } from '../../models/user';

@Component({
  selector: 'my-user-login',
  styleUrls: [ 'app/angular/users/components/login/login.component.css' ],
  templateUrl: 'app/angular/users/components/login/login.component.html'
})

export class UserLoginComponent {
  constructor(private _authService: AuthService, private _router: Router) {}

  login(username: string, password: string) {
    this._authService.login(username, password).subscribe(
      result => {
        const user = new User(username, result);
        user.save();

        this._authService.setStatus(AuthStatus.LoggedIn);

        this._router.navigate(['VideosList']);
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
