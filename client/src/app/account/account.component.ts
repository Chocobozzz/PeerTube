import {  } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AccountService } from './account.service';

@Component({
  selector: 'my-account',
  template: require('./account.component.html')
})

export class AccountComponent implements OnInit {
  newPassword = '';
  newConfirmedPassword = '';
  changePasswordForm: FormGroup;
  information: string = null;
  error: string = null;

  constructor(
    private accountService: AccountService,
    private router: Router
  ) {}

  ngOnInit() {
    this.changePasswordForm = new FormGroup({
      'new-password': new FormControl('', [ <any>Validators.required, <any>Validators.minLength(6) ]),
      'new-confirmed-password': new FormControl('', [ <any>Validators.required, <any>Validators.minLength(6) ]),
    });
  }

  changePassword() {
    this.information = null;
    this.error = null;

    if (this.newPassword !== this.newConfirmedPassword) {
      this.error = 'The new password and the confirmed password do not correspond.';
      return;
    }

    this.accountService.changePassword(this.newPassword).subscribe(
      ok => this.information = 'Password updated.',

      err => this.error = err
    );
  }
}
