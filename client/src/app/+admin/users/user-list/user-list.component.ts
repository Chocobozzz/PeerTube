import { Component } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { RestDataSource, User, Utils } from '../../../shared'
import { UserService } from '../shared'
import { Router } from '@angular/router'

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent {
  usersSource: RestDataSource = null
  tableSettings = {
    mode: 'external',
    attr: {
      class: 'table-hover'
    },
    hideSubHeader: true,
    actions: {
      position: 'right',
      add: false,
      edit: true,
      delete: true
    },
    delete: {
      deleteButtonContent: Utils.getRowDeleteButton()
    },
    edit: {
      editButtonContent: Utils.getRowEditButton()
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
      videoQuota: {
        title: 'Video quota'
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
  }

  constructor (
    private router: Router,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService
  ) {
    this.usersSource = this.userService.getDataSource()
  }

  editUser ({ data }: { data: User }) {
    this.router.navigate([ '/admin', 'users', data.id, 'update' ])
  }

  removeUser ({ data }: { data: User }) {
    const user = data

    if (user.username === 'root') {
      this.notificationsService.error('Error', 'You cannot delete root.')
      return
    }

    this.confirmService.confirm('Do you really want to delete this user?', 'Delete').subscribe(
      res => {
        if (res === false) return

        this.userService.removeUser(user).subscribe(
          () => {
            this.notificationsService.success('Success', `User ${user.username} deleted.`)
            this.usersSource.refresh()
          },

          err => this.notificationsService.error('Error', err.text)
        )
      }
    )
  }
}
