import { Component, OnInit } from '@angular/core'
import { SortMeta } from 'primeng/primeng'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { RestTable, RestPagination, User } from '../../../shared'
import { UserService } from '../shared'

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent extends RestTable implements OnInit {
  users: User[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'id', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService
  ) {
    super()
  }

  ngOnInit () {
    this.loadData()
  }

  removeUser (user: User) {
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
            this.loadData()
          },

          err => this.notificationsService.error('Error', err.message)
        )
      }
    )
  }

  getRouterUserEditLink (user: User) {
    return [ '/admin', 'users', user.id, 'update' ]
  }

  protected loadData () {
    this.userService.getUsers(this.pagination, this.sort)
                    .subscribe(
                      resultList => {
                        this.users = resultList.data
                        this.totalRecords = resultList.total
                      },

                      err => this.notificationsService.error('Error', err.message)
                    )
  }
}
