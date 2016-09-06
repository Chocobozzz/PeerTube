import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../shared';

@Component({
  selector: 'my-login',
  template: require('./login.component.html')
})

export class LoginComponent implements OnInit {
  error: string = null;
  username = '';
  password: '';
  loginForm: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loginForm = new FormGroup({
      username: new FormControl('', [ <any>Validators.required ]),
      password: new FormControl('', [ <any>Validators.required ]),
    });
  }

  login() {
    this.authService.login(this.username, this.password).subscribe(
      result => {
        this.error = null;

        this.router.navigate(['/videos/list']);
      },
      error => {
        console.error(error.json);

        if (error.json.error === 'invalid_grant') {
          this.error = 'Credentials are invalid.';
        } else {
          this.error = `${error.json.error}: ${error.json.error_description}`;
        }
      }
    );
  }
}
