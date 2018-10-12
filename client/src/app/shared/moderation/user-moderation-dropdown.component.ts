import { Component, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '@app/shared/buttons/action-dropdown.component'
import { UserBanModalComponent } from '@app/shared/moderation/user-ban-modal.component'
import { UserService } from '@app/shared/users'
import { AuthService, ConfirmService } from '@app/core'
import { User, UserRight } from '../../../../../shared/models/users'
import { Account } from '@app/shared/account/account.model'
import { BlocklistService } from '@app/shared/blocklist'

@Component({
  selector: 'my-user-moderation-dropdown',
  templateUrl: './user-moderation-dropdown.component.html',
  styleUrls: [ './user-moderation-dropdown.component.scss' ]
})
export class UserModerationDropdownComponent implements OnChanges {
  @ViewChild('userBanModal') userBanModal: UserBanModalComponent

  @Input() user: User
  @Input() account: Account

  @Input() buttonSize: 'normal' | 'small' = 'normal'
  @Input() placement = 'left'

  @Output() userChanged = new EventEmitter()
  @Output() userDeleted = new EventEmitter()

  userActions: DropdownAction<User>[] = []

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private userService: UserService,
    private blocklistService: BlocklistService,
    private i18n: I18n
  ) { }

  ngOnChanges () {
    this.buildActions()
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

    this.userService.unbanUsers(user)
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

  blockAccountByUser (account: Account) {
    this.blocklistService.blockAccountByUser(account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} muted.', { nameWithHost: account.nameWithHost })
            )

            this.account.muted = true
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unblockAccountByUser (account: Account) {
    this.blocklistService.unblockAccountByUser(account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} unmuted.', { nameWithHost: account.nameWithHost })
            )

            this.account.muted = false
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  blockServerByUser (host: string) {
    this.blocklistService.blockServerByUser(host)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Instance {{host}} muted.', { host })
            )

            this.account.mutedServer = true
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unblockServerByUser (host: string) {
    this.blocklistService.unblockServerByUser(host)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Instance {{host}} unmuted.', { host })
            )

            this.account.mutedServer = false
            this.userChanged.emit()
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

      if (this.user && authUser.id === this.user.id) return

      if (this.user && authUser.hasRight(UserRight.MANAGE_USERS)) {
        this.userActions = this.userActions.concat([
          {
            label: this.i18n('Edit'),
            linkBuilder: ({ user }) => this.getRouterUserEditLink(user)
          },
          {
            label: this.i18n('Delete'),
            handler: ({ user }) => this.removeUser(user)
          },
          {
            label: this.i18n('Ban'),
            handler: ({ user }) => this.openBanUserModal(user),
            isDisplayed: ({ user }) => !user.muted
          },
          {
            label: this.i18n('Unban'),
            handler: ({ user }) => this.unbanUser(user),
            isDisplayed: ({ user }) => user.muted
          }
        ])
      }

      // User actions on accounts/servers
      if (this.account) {
        this.userActions = this.userActions.concat([
          {
            label: this.i18n('Mute this account'),
            isDisplayed: ({ account }) => account.muted === false,
            handler: ({ account }) => this.blockAccountByUser(account)
          },
          {
            label: this.i18n('Unmute this account'),
            isDisplayed: ({ account }) => account.muted === true,
            handler: ({ account }) => this.unblockAccountByUser(account)
          },
          {
            label: this.i18n('Mute the instance'),
            isDisplayed: ({ account }) => !account.userId && account.mutedServer === false,
            handler: ({ account }) => this.blockServerByUser(account.host)
          },
          {
            label: this.i18n('Unmute the instance'),
            isDisplayed: ({ account }) => !account.userId && account.mutedServer === true,
            handler: ({ account }) => this.unblockServerByUser(account.host)
          }
        ])
      }
    }
  }
}
