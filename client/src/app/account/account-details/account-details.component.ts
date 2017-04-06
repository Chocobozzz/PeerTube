import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { NotificationsService } from 'angular2-notifications';

import { AuthService } from '../../core';
import {
  FormReactive,
  User,
  UserService,
  USER_PASSWORD
} from '../../shared';

@Component({
  selector: 'my-account-details',
  templateUrl: './account-details.component.html'
})

export class AccountDetailsComponent extends FormReactive implements OnInit {
  @Input() user: User = null;

  error: string = null;

  form: FormGroup;
  formErrors = {};
  validationMessages = {};

  constructor(
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService
  ) {
    super();
  }

  buildForm() {
    this.form = this.formBuilder.group({
      displayNSFW: [ this.user.displayNSFW ],
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.buildForm();
  }

  updateDetails() {
    const displayNSFW = this.form.value['displayNSFW'];
    const details = {
      displayNSFW
    };

    this.error = null;
    this.userService.updateDetails(details).subscribe(
      () => {
        this.notificationsService.success('Success', 'Informations updated.');

        this.authService.refreshUserInformations();
      },

      err => this.error = err
    );
  }
}
