import {  } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { AccountService } from './account.service';
import { FormReactive, USER_PASSWORD } from '../shared';

@Component({
  selector: 'my-account',
  template: require('./account.component.html')
})

export class AccountComponent extends FormReactive implements OnInit {
  information: string = null;
  error: string = null;

  form: FormGroup;
  formErrors = {
    'new-password': '',
    'new-confirmed-password': ''
  };
  validationMessages = {
    'new-password': USER_PASSWORD.MESSAGES,
    'new-confirmed-password': USER_PASSWORD.MESSAGES
  };

  constructor(
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    super();
  }

  buildForm() {
    this.form = this.formBuilder.group({
      'new-password': [ '', USER_PASSWORD.VALIDATORS ],
      'new-confirmed-password': [ '', USER_PASSWORD.VALIDATORS ],
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.buildForm();
  }

  changePassword() {
    const newPassword = this.form.value['new-password'];
    const newConfirmedPassword = this.form.value['new-confirmed-password'];

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
