import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '@app/shared/buttons/action-dropdown.component'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { UserBanModalComponent } from '@app/shared/moderation/user-ban-modal.component'
import { UserService } from '@app/shared/users'
import { AuthService, ConfirmService } from '@app/core'
import { User, UserRight } from '../../../../../shared/models/users'

@Component({
  selector: 'my-user-moderation-dropdown',
  templateUrl: './user-moderation-dropdown.component.html',
  styleUrls: [ './user-moderation-dropdown.component.scss' ]
})
export class UserModerationDropdownComponent implements OnInit {
  @ViewChild('userBanModal') userBanModal: UserBanModalComponent

  @Input() user: User
  @Input() buttonSize: 'normal' | 'small' = 'normal'

  @Output() userChanged = new EventEmitter()
  @Output() userDeleted = new EventEmitter()

  userActions: DropdownAction<User>[] = []

  private openedModal: NgbModalRef

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService,
    private i18n: I18n
  ) { }

  ngOnInit () {
    this.buildActions()
  }

  hideBanUserModal () {
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
    this.userChanged.emit()
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

            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  async removeUser (user: User) {
    if (user.username === 'root') {
      this.notificationsService.error(this.i18n('Error'), this.i18n('You cannot delete root.'))
      return
    }

    const message = this.i18n('If you remove this user, you will not be able to create another with the same username!')
    const res = await this.confirmService.confirm(message, this.i18n('Delete'))
    if (res === false) return

    this.userService.removeUser(user).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('User {{username}} deleted.', { username: user.username })
        )
        this.userDeleted.emit()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  getRouterUserEditLink (user: User) {
    return [ '/admin', 'users', 'update', user.id ]
  }

  private buildActions () {
    this.userActions = []

    if (this.authService.isLoggedIn()) {
      const authUser = this.authService.getUser()

      if (authUser.hasRight(UserRight.MANAGE_USERS)) {
        this.userActions = this.userActions.concat([
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
        ])
      }
    }
  }
}
