import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ConfirmService } from '../../../core'
import { RestPagination, RestTable } from '../../../shared'
import { UserService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '@app/shared/buttons/action-dropdown.component'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { UserBanModalComponent } from '@app/+admin/users/user-list/user-ban-modal.component'
import { User } from '../../../../../../shared'

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
  userActions: DropdownAction<User>[] = []

  private userToBan: User
  private openedModal: NgbModalRef

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()

    this.userActions = [
      {
        label: this.i18n('Edit'),
        linkBuilder: this.getRouterUserEditLink
      },
      {
        label: this.i18n('Delete'),
        handler: user => this.removeUser(user)
      },
      {
        label: this.i18n('Ban'),
        handler: user => this.openBanUserModal(user),
        isDisplayed: user => !user.blocked
      },
      {
        label: this.i18n('Unban'),
        handler: user => this.unbanUser(user),
        isDisplayed: user => user.blocked
      }
    ]
  }

  ngOnInit () {
    this.loadSort()
  }

  hideBanUserModal () {
    this.userToBan = undefined
    this.openedModal.close()
  }

  openBanUserModal (user: User) {
    if (user.username === 'root') {
      this.notificationsService.error(this.i18n('Error'), this.i18n('You cannot ban root.'))
      return
    }

    this.userBanModal.openModal(user)
  }

  onUserBanned () {
    this.loadData()
  }

  async unbanUser (user: User) {
    const message = this.i18n('Do you really want to unban {{username}}?', { username: user.username })
    const res = await this.confirmService.confirm(message, this.i18n('Unban'))
    if (res === false) return

    this.userService.unbanUser(user)
      .subscribe(
        () => {
          this.notificationsService.success(
            this.i18n('Success'),
            this.i18n('User {{username}} unbanned.', { username: user.username })
          )
          this.loadData()
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  async removeUser (user: User) {
    if (user.username === 'root') {
      this.notificationsService.error(this.i18n('Error'), this.i18n('You cannot delete root.'))
      return
    }

    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this user?'), this.i18n('Delete'))
    if (res === false) return

    this.userService.removeUser(user).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('User {{username}} deleted.', { username: user.username })
        )
        this.loadData()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  getRouterUserEditLink (user: User) {
    return [ '/admin', 'users', 'update', user.id ]
  }

  protected loadData () {
    this.userService.getUsers(this.pagination, this.sort)
                    .subscribe(
                      resultList => {
                        this.users = resultList.data
                        this.totalRecords = resultList.total
                      },

                      err => this.notificationsService.error(this.i18n('Error'), err.message)
                    )
  }
}
