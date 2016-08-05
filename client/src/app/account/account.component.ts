import { Control, ControlGroup, Validators } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AccountService } from './account.service';

@Component({
  selector: 'my-account',
  template: require('./account.component.html'),
  providers: [ AccountService ]
})

export class AccountComponent implements OnInit {
  changePasswordForm: ControlGroup;
  information: string = null;
  error: string = null;

  constructor(
    private accountService: AccountService,
    private router: Router
  ) {}

  ngOnInit() {
    this.changePasswordForm = new ControlGroup({
      newPassword: new Control('', Validators.compose([ Validators.required, Validators.minLength(6) ])),
      newConfirmedPassword: new Control('', Validators.compose([ Validators.required, Validators.minLength(6) ])),
    });
  }

  changePassword(newPassword: string, newConfirmedPassword: string) {
    this.information = null;
    this.error = null;

    if (newPassword !== newConfirmedPassword) {
      this.error = 'The new password and the confirmed password do not correspond.';
      return;
    }

    this.accountService.changePassword(newPassword).subscribe(
      ok => this.information = 'Password updated.',

      err => this.error = err
    );
  }
}
