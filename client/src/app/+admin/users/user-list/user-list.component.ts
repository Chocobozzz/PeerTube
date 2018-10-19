import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ConfirmService } from '../../../core'
import { RestPagination, RestTable, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '../../../../../../shared'
import { UserBanModalComponent } from '@app/shared/moderation'
import { DropdownAction } from '@app/shared/buttons/action-dropdown.component'

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent extends RestTable implements OnInit {
  @ViewChild('userBanModal') userBanModal: UserBanModalComponent

  users: User[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  selectedUsers: User[] = []
  bulkUserActions: DropdownAction<User[]>[] = []

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()

    this.bulkUserActions = [
      {
        label: this.i18n('Delete'),
        handler: users => this.removeUsers(users)
      },
      {
        label: this.i18n('Ban'),
        handler: users => this.openBanUserModal(users),
        isDisplayed: users => users.every(u => u.blocked === false)
      },
      {
        label: this.i18n('Unban'),
        handler: users => this.unbanUsers(users),
        isDisplayed: users => users.every(u => u.blocked === true)
      }
    ]
  }

  openBanUserModal (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notificationsService.error(this.i18n('Error'), this.i18n('You cannot ban root.'))
        return
      }
    }

    this.userBanModal.openModal(users)
  }

  onUsersBanned () {
    this.loadData()
  }

  async unbanUsers (users: User[]) {
    const message = this.i18n('Do you really want to unban {{num}} users?', { num: users.length })

    const res = await this.confirmService.confirm(message, this.i18n('Unban'))
    if (res === false) return

    this.userService.unbanUsers(users)
        .subscribe(
          () => {
            const message = this.i18n('{{num}} users unbanned.', { num: users.length })

            this.notificationsService.success(this.i18n('Success'), message)
            this.loadData()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  async removeUsers (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notificationsService.error(this.i18n('Error'), this.i18n('You cannot delete root.'))
        return
      }
    }

    const message = this.i18n('If you remove these users, you will not be able to create others with the same username!')
    const res = await this.confirmService.confirm(message, this.i18n('Delete'))
    if (res === false) return

    this.userService.removeUser(users).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('{{num}} users deleted.', { num: users.length })
        )
        this.loadData()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  isInSelectionMode () {
    return this.selectedUsers.length !== 0
  }

  protected loadData () {
    this.selectedUsers = []

    this.userService.getUsers(this.pagination, this.sort, this.search)
                    .subscribe(
                      resultList => {
                        this.users = resultList.data
                        this.totalRecords = resultList.total
                      },

                      err => this.notificationsService.error(this.i18n('Error'), err.message)
                    )
  }
}
