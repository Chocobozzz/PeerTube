import { Component, OnInit } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import { User } from '../../../shared';
import { UserService } from '../shared';

@Component({
  selector: 'my-user-list',
  template: require('./user-list.component.html'),
  styles: [ require('./user-list.component.scss') ],
  directives: [ ROUTER_DIRECTIVES ]
})
export class UserListComponent implements OnInit {
  totalUsers: number;
  users: User[];

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.getUsers();
  }

  getUsers() {
    this.userService.getUsers().subscribe(
      ({ users, totalUsers }) => {
        this.users = users;
        this.totalUsers = totalUsers;
      },

      err => alert(err)
    );
  }


  removeUser(user: User) {
    if (confirm('Are you sure?')) {
      this.userService.removeUser(user).subscribe(
        () => this.getUsers(),

        err => alert(err)
      );
    }
  }
}
