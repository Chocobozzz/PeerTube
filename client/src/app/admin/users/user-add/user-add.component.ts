import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { UserService } from '../shared';
import { FormReactive, USER_USERNAME, USER_PASSWORD } from '../../../shared';

@Component({
  selector: 'my-user-add',
  template: require('./user-add.component.html')
})
export class UserAddComponent extends FormReactive implements OnInit {
  error: string = null;

  form: FormGroup;
  formErrors = {
    'username': '',
    'password': ''
  };
  validationMessages = {
    'username': USER_USERNAME.MESSAGES,
    'password': USER_PASSWORD.MESSAGES,
  };

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private userService: UserService
  ) {
    super();
  }

  buildForm() {
    this.form = this.formBuilder.group({
      username: [ '', USER_USERNAME.VALIDATORS ],
      password: [ '', USER_PASSWORD.VALIDATORS ],
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.buildForm();
  }

  addUser() {
    this.error = null;

    const { username, password } = this.form.value;

    this.userService.addUser(username, password).subscribe(
      ok => this.router.navigate([ '/admin/users/list' ]),

      err => this.error = err.text
    );
  }
}
