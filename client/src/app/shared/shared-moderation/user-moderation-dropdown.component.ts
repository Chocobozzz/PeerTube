import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ServerService, UserService } from '@app/core'
import { Account, DropdownAction } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { BulkRemoveCommentsOfBody, ServerConfig, User, UserRight } from '@shared/models'
import { BlocklistService } from './blocklist.service'
import { BulkService } from './bulk.service'
import { UserBanModalComponent } from './user-ban-modal.component'

@Component({
  selector: 'my-user-moderation-dropdown',
  templateUrl: './user-moderation-dropdown.component.html'
})
export class UserModerationDropdownComponent implements OnInit, OnChanges {
  @ViewChild('userBanModal') userBanModal: UserBanModalComponent

  @Input() user: User
  @Input() account: Account
  @Input() prependActions: DropdownAction<{ user: User, account: Account }>[]

  @Input() buttonSize: 'normal' | 'small' = 'normal'
  @Input() placement = 'right-top right-bottom auto'
  @Input() label: string
  @Input() container: 'body' | undefined = undefined

  @Output() userChanged = new EventEmitter()
  @Output() userDeleted = new EventEmitter()

  userActions: DropdownAction<{ user: User, account: Account }>[][] = []

  private serverConfig: ServerConfig

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private serverService: ServerService,
    private userService: UserService,
    private blocklistService: BlocklistService,
    private bulkService: BulkService,
    private i18n: I18n
  ) { }

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)
  }

  ngOnChanges () {
    this.buildActions()
  }

  openBanUserModal (user: User) {
    if (user.username === 'root') {
      this.notifier.error(this.i18n('You cannot ban root.'))
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
            this.notifier.success(this.i18n('User {{username}} unbanned.', { username: user.username }))

            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  async removeUser (user: User) {
    if (user.username === 'root') {
      this.notifier.error(this.i18n('You cannot delete root.'))
      return
    }

    const message = this.i18n('If you remove this user, you will not be able to create another with the same username!')
    const res = await this.confirmService.confirm(message, this.i18n('Delete'))
    if (res === false) return

    this.userService.removeUser(user).subscribe(
      () => {
        this.notifier.success(this.i18n('User {{username}} deleted.', { username: user.username }))
        this.userDeleted.emit()
      },

      err => this.notifier.error(err.message)
    )
  }

  setEmailAsVerified (user: User) {
    this.userService.updateUser(user.id, { emailVerified: true }).subscribe(
      () => {
        this.notifier.success(this.i18n('User {{username}} email set as verified', { username: user.username }))

        this.userChanged.emit()
      },

      err => this.notifier.error(err.message)
    )
  }

  blockAccountByUser (account: Account) {
    this.blocklistService.blockAccountByUser(account)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} muted.', { nameWithHost: account.nameWithHost }))

            this.account.mutedByUser = true
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  unblockAccountByUser (account: Account) {
    this.blocklistService.unblockAccountByUser(account)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} unmuted.', { nameWithHost: account.nameWithHost }))

            this.account.mutedByUser = false
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  blockServerByUser (host: string) {
    this.blocklistService.blockServerByUser(host)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Instance {{host}} muted.', { host }))

            this.account.mutedServerByUser = true
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  unblockServerByUser (host: string) {
    this.blocklistService.unblockServerByUser(host)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Instance {{host}} unmuted.', { host }))

            this.account.mutedServerByUser = false
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  blockAccountByInstance (account: Account) {
    this.blocklistService.blockAccountByInstance(account)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} muted by the instance.', { nameWithHost: account.nameWithHost }))

            this.account.mutedByInstance = true
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  unblockAccountByInstance (account: Account) {
    this.blocklistService.unblockAccountByInstance(account)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} unmuted by the instance.', { nameWithHost: account.nameWithHost }))

            this.account.mutedByInstance = false
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  blockServerByInstance (host: string) {
    this.blocklistService.blockServerByInstance(host)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Instance {{host}} muted by the instance.', { host }))

            this.account.mutedServerByInstance = true
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  unblockServerByInstance (host: string) {
    this.blocklistService.unblockServerByInstance(host)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Instance {{host}} unmuted by the instance.', { host }))

            this.account.mutedServerByInstance = false
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  async bulkRemoveCommentsOf (body: BulkRemoveCommentsOfBody) {
    const message = this.i18n('Are you sure you want to remove all the comments of this account?')
    const res = await this.confirmService.confirm(message, this.i18n('Delete account comments'))
    if (res === false) return

    this.bulkService.removeCommentsOf(body)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Will remove comments of this account (may take several minutes).'))
          },

          err => this.notifier.error(err.message)
        )
  }

  getRouterUserEditLink (user: User) {
    return [ '/admin', 'users', 'update', user.id ]
  }

  private buildActions () {
    this.userActions = []

    if (this.prependActions) {
      this.userActions = [
        this.prependActions
      ]
    }

    if (this.authService.isLoggedIn()) {
      const authUser = this.authService.getUser()

      if (this.user && authUser.id === this.user.id) return

      if (this.user && authUser.hasRight(UserRight.MANAGE_USERS) && authUser.canManage(this.user)) {
        this.userActions.push([
          {
            label: this.i18n('Edit user'),
            description: this.i18n('Change quota, role, and more.'),
            linkBuilder: ({ user }) => this.getRouterUserEditLink(user)
          },
          {
            label: this.i18n('Delete user'),
            description: this.i18n('Videos will be deleted, comments will be tombstoned.'),
            handler: ({ user }) => this.removeUser(user)
          },
          {
            label: this.i18n('Ban'),
            description: this.i18n('User won\'t be able to login anymore, but videos and comments will be kept as is.'),
            handler: ({ user }) => this.openBanUserModal(user),
            isDisplayed: ({ user }) => !user.blocked
          },
          {
            label: this.i18n('Unban user'),
            description: this.i18n('Allow the user to login and create videos/comments again'),
            handler: ({ user }) => this.unbanUser(user),
            isDisplayed: ({ user }) => user.blocked
          },
          {
            label: this.i18n('Set Email as Verified'),
            handler: ({ user }) => this.setEmailAsVerified(user),
            isDisplayed: ({ user }) => this.requiresEmailVerification && !user.blocked && user.emailVerified === false
          }
        ])
      }

      // Actions on accounts/servers
      if (this.account) {
        // User actions
        this.userActions.push([
          {
            label: this.i18n('Mute this account'),
            description: this.i18n('Hide any content from that user for you.'),
            isDisplayed: ({ account }) => account.mutedByUser === false,
            handler: ({ account }) => this.blockAccountByUser(account)
          },
          {
            label: this.i18n('Unmute this account'),
            description: this.i18n('Show back content from that user for you.'),
            isDisplayed: ({ account }) => account.mutedByUser === true,
            handler: ({ account }) => this.unblockAccountByUser(account)
          },
          {
            label: this.i18n('Mute the instance'),
            description: this.i18n('Hide any content from that instance for you.'),
            isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === false,
            handler: ({ account }) => this.blockServerByUser(account.host)
          },
          {
            label: this.i18n('Unmute the instance'),
            description: this.i18n('Show back content from that instance for you.'),
            isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === true,
            handler: ({ account }) => this.unblockServerByUser(account.host)
          },
          {
            label: this.i18n('Remove comments from your videos'),
            description: this.i18n('Remove comments of this account from your videos.'),
            handler: ({ account }) => this.bulkRemoveCommentsOf({ accountName: account.nameWithHost, scope: 'my-videos' })
          }
        ])

        let instanceActions: DropdownAction<{ user: User, account: Account }>[] = []

        // Instance actions on account blocklists
        if (authUser.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
          instanceActions = instanceActions.concat([
            {
              label: this.i18n('Mute this account by your instance'),
              description: this.i18n('Hide any content from that user for you, your instance and its users.'),
              isDisplayed: ({ account }) => account.mutedByInstance === false,
              handler: ({ account }) => this.blockAccountByInstance(account)
            },
            {
              label: this.i18n('Unmute this account by your instance'),
              description: this.i18n('Show back content from that user for you, your instance and its users.'),
              isDisplayed: ({ account }) => account.mutedByInstance === true,
              handler: ({ account }) => this.unblockAccountByInstance(account)
            }
          ])
        }

        // Instance actions on server blocklists
        if (authUser.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
          instanceActions = instanceActions.concat([
            {
              label: this.i18n('Mute the instance by your instance'),
              description: this.i18n('Hide any content from that instance for you, your instance and its users.'),
              isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === false,
              handler: ({ account }) => this.blockServerByInstance(account.host)
            },
            {
              label: this.i18n('Unmute the instance by your instance'),
              description: this.i18n('Show back content from that instance for you, your instance and its users.'),
              isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === true,
              handler: ({ account }) => this.unblockServerByInstance(account.host)
            }
          ])
        }

        if (authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)) {
          instanceActions = instanceActions.concat([
            {
              label: this.i18n('Remove comments from your instance'),
              description: this.i18n('Remove comments of this account from your instance.'),
              handler: ({ account }) => this.bulkRemoveCommentsOf({ accountName: account.nameWithHost, scope: 'instance' })
            }
          ])
        }

        if (instanceActions.length !== 0) {
          this.userActions.push(instanceActions)
        }
      }
    }
  }
}
