import { Component, OnInit } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { User } from '../../../shared';
import { UserService } from '../shared';

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent implements OnInit {
  totalUsers: number;
  users: User[];

  constructor(
    private notificationsService: NotificationsService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.getUsers();
  }

  getUsers() {
    this.userService.getUsers().subscribe(
      ({ users, totalUsers }) => {
        this.users = users;
        this.totalUsers = totalUsers;
      },

      err => this.notificationsService.error('Error', err.text)
    );
  }


  removeUser(user: User) {
    if (confirm('Are you sure?')) {
      this.userService.removeUser(user).subscribe(
        () => {
          this.notificationsService.success('Success', `User ${user.username} deleted.`);
          this.getUsers();
        },

        err => this.notificationsService.error('Error', err.text)
      );
    }
  }
}
