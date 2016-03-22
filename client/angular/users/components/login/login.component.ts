import { Component } from 'angular2/core';
import { Router } from 'angular2/router';

import { AuthService } from '../../services/auth.service';
import { AuthStatus } from '../../models/authStatus';
import { Token } from '../../models/token';

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
        if (result.error) return alert(result.error_description);

        let token = new Token(result);
        token.save();

        this._authService.setStatus(AuthStatus.LoggedIn);

        this._router.navigate(['VideosList']);
      },
      error => alert(error)
    );
  }
}
