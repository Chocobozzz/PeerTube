import { Control, ControlGroup, Validators } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { UserService } from '../shared';

@Component({
  selector: 'my-user-add',
  template: require('./user-add.component.html'),
})
export class UserAddComponent implements OnInit {
  userAddForm: ControlGroup;
  error: string = null;

  constructor(private router: Router, private userService: UserService) {}

  ngOnInit() {
    this.userAddForm = new ControlGroup({
      username: new Control('', Validators.compose([ Validators.required, Validators.minLength(3), Validators.maxLength(20) ])),
      password: new Control('', Validators.compose([ Validators.required, Validators.minLength(6) ])),
    });
  }

  addUser(username: string, password: string) {
    this.error = null;

    this.userService.addUser(username, password).subscribe(
      ok => this.router.navigate([ '/admin/users/list' ]),

      err => this.error = err
    );
  }
}
