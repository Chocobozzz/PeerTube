import { Component } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { ConfirmService } from '../../../core';
import { User, Utils } from '../../../shared';
import { UserService } from '../shared';

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent {
  usersSource = null;
  tableSettings = {
    mode: 'external',
    attr: {
      class: 'table-hover'
    },
    hideSubHeader: true,
    actions: {
      position: 'right',
      add: false,
      edit: false,
      delete: true
    },
    delete: {
      deleteButtonContent: Utils.getRowDeleteButton()
    },
    pager: {
      display: true,
      perPage: 10
    },
    columns: {
      id: {
        title: 'ID',
        sortDirection: 'asc'
      },
      username: {
        title: 'Username'
      },
      email: {
        title: 'Email'
      },
      role: {
        title: 'Role',
        sort: false
      },
      createdAt: {
        title: 'Created Date',
        valuePrepareFunction: Utils.dateToHuman
      }
    }
  };

  constructor(
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService
  ) {
    this.usersSource = this.userService.getDataSource();
  }

  removeUser({ data }) {
    const user: User = data;

    if (user.username === 'root') {
      this.notificationsService.error('Error', 'You cannot delete root.');
      return;
    }

    this.confirmService.confirm('Do you really want to delete this user?', 'Delete').subscribe(
      res => {
        if (res === false) return;

        this.userService.removeUser(user).subscribe(
          () => {
            this.notificationsService.success('Success', `User ${user.username} deleted.`);
            this.usersSource.refresh();
          },

          err => this.notificationsService.error('Error', err.text)
        );
      }
    );
  }
}
