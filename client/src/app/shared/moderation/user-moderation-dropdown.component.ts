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

  userActions: DropdownAction<{ user: User, account: Account }>[] = []

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

            this.account.mutedByUser = true
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

            this.account.mutedByUser = false
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

            this.account.mutedServerByUser = true
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

            this.account.mutedServerByUser = false
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  blockAccountByInstance (account: Account) {
    this.blocklistService.blockAccountByInstance(account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} muted by the instance.', { nameWithHost: account.nameWithHost })
            )

            this.account.mutedByInstance = true
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unblockAccountByInstance (account: Account) {
    this.blocklistService.unblockAccountByInstance(account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} unmuted by the instance.', { nameWithHost: account.nameWithHost })
            )

            this.account.mutedByInstance = false
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  blockServerByInstance (host: string) {
    this.blocklistService.blockServerByInstance(host)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Instance {{host}} muted by the instance.', { host })
            )

            this.account.mutedServerByInstance = true
            this.userChanged.emit()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unblockServerByInstance (host: string) {
    this.blocklistService.unblockServerByInstance(host)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Instance {{host}} unmuted by the instance.', { host })
            )

            this.account.mutedServerByInstance = false
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
            handler: ({ user }: { user: User }) => this.openBanUserModal(user),
            isDisplayed: ({ user }: { user: User }) => !user.blocked
          },
          {
            label: this.i18n('Unban'),
            handler: ({ user }: { user: User }) => this.unbanUser(user),
            isDisplayed: ({ user }: { user: User }) => user.blocked
          }
        ])
      }

      // Actions on accounts/servers
      if (this.account) {
        // User actions
        this.userActions = this.userActions.concat([
          {
            label: this.i18n('Mute this account'),
            isDisplayed: ({ account }: { account: Account }) => account.mutedByUser === false,
            handler: ({ account }: { account: Account }) => this.blockAccountByUser(account)
          },
          {
            label: this.i18n('Unmute this account'),
            isDisplayed: ({ account }: { account: Account }) => account.mutedByUser === true,
            handler: ({ account }: { account: Account }) => this.unblockAccountByUser(account)
          },
          {
            label: this.i18n('Mute the instance'),
            isDisplayed: ({ account }: { account: Account }) => !account.userId && account.mutedServerByInstance === false,
            handler: ({ account }: { account: Account }) => this.blockServerByUser(account.host)
          },
          {
            label: this.i18n('Unmute the instance'),
            isDisplayed: ({ account }: { account: Account }) => !account.userId && account.mutedServerByInstance === true,
            handler: ({ account }: { account: Account }) => this.unblockServerByUser(account.host)
          }
        ])

        // Instance actions
        if (authUser.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
          this.userActions = this.userActions.concat([
            {
              label: this.i18n('Mute this account by your instance'),
              isDisplayed: ({ account }: { account: Account }) => account.mutedByInstance === false,
              handler: ({ account }: { account: Account }) => this.blockAccountByInstance(account)
            },
            {
              label: this.i18n('Unmute this account by your instance'),
              isDisplayed: ({ account }: { account: Account }) => account.mutedByInstance === true,
              handler: ({ account }: { account: Account }) => this.unblockAccountByInstance(account)
            }
          ])
        }

        // Instance actions
        if (authUser.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
          this.userActions = this.userActions.concat([
            {
              label: this.i18n('Mute the instance by your instance'),
              isDisplayed: ({ account }: { account: Account }) => !account.userId && account.mutedServerByInstance === false,
              handler: ({ account }: { account: Account }) => this.blockServerByInstance(account.host)
            },
            {
              label: this.i18n('Unmute the instance by your instance'),
              isDisplayed: ({ account }: { account: Account }) => !account.userId && account.mutedServerByInstance === true,
              handler: ({ account }: { account: Account }) => this.unblockServerByInstance(account.host)
            }
          ])
        }
      }
    }
  }
}
