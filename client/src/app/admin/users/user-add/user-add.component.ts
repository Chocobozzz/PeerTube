import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { UserService } from '../shared';

@Component({
  selector: 'my-user-add',
  template: require('./user-add.component.html')
})
export class UserAddComponent implements OnInit {
  userAddForm: FormGroup;
  error: string = null;
  username = '';
  password = '';

  constructor(private router: Router, private userService: UserService) {}

  ngOnInit() {
    this.userAddForm = new FormGroup({
      username: new FormControl('', [ <any>Validators.required, <any>Validators.minLength(3), <any>Validators.maxLength(20) ]),
      password: new FormControl('', [ <any>Validators.required, <any>Validators.minLength(6) ]),
    });
  }

  addUser() {
    this.error = null;

    this.userService.addUser(this.username, this.password).subscribe(
      ok => this.router.navigate([ '/admin/users/list' ]),

      err => this.error = err.text
    );
  }
}
