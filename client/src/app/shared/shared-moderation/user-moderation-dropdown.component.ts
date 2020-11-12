import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ServerService, UserService } from '@app/core'
import { Account, DropdownAction } from '@app/shared/shared-main'
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
    private bulkService: BulkService
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
      this.notifier.error($localize`You cannot ban root.`)
      return
    }

    this.userBanModal.openModal(user)
  }

  onUserBanned () {
    this.userChanged.emit()
  }

  async unbanUser (user: User) {
    const res = await this.confirmService.confirm($localize`Do you really want to unban ${user.username}?`, $localize`Unban`)
    if (res === false) return

    this.userService.unbanUsers(user)
        .subscribe(
          () => {
            this.notifier.success($localize`User ${user.username} unbanned.`)
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  async removeUser (user: User) {
    if (user.username === 'root') {
      this.notifier.error($localize`You cannot delete root.`)
      return
    }

    const message = $localize`If you remove this user, you will not be able to create another with the same username!`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.userService.removeUser(user).subscribe(
      () => {
        this.notifier.success($localize`User ${user.username} deleted.`)
        this.userDeleted.emit()
      },

      err => this.notifier.error(err.message)
    )
  }

  setEmailAsVerified (user: User) {
    this.userService.updateUser(user.id, { emailVerified: true }).subscribe(
      () => {
        this.notifier.success($localize`User ${user.username} email set as verified`)
        this.userChanged.emit()
      },

      err => this.notifier.error(err.message)
    )
  }

  blockAccountByUser (account: Account) {
    this.blocklistService.blockAccountByUser(account)
        .subscribe(
          () => {
            this.notifier.success($localize`Account ${account.nameWithHost} muted.`)

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
            this.notifier.success($localize`Account ${account.nameWithHost} unmuted.`)

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
            this.notifier.success($localize`Instance ${host} muted.`)

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
            this.notifier.success($localize`Instance ${host} unmuted.`)

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
            this.notifier.success($localize`Account ${account.nameWithHost} muted by the instance.`)

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
            this.notifier.success($localize`Account ${account.nameWithHost} unmuted by the instance.`)

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
            this.notifier.success($localize`Instance ${host} muted by the instance.`)

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
            this.notifier.success($localize`Instance ${host} unmuted by the instance.`)

            this.account.mutedServerByInstance = false
            this.userChanged.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  async bulkRemoveCommentsOf (body: BulkRemoveCommentsOfBody) {
    const message = $localize`Are you sure you want to remove all the comments of this account?`
    const res = await this.confirmService.confirm(message, $localize`Delete account comments`)
    if (res === false) return

    this.bulkService.removeCommentsOf(body)
        .subscribe(
          () => {
            this.notifier.success($localize`Will remove comments of this account (may take several minutes).`)
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
            label: $localize`Edit user`,
            description: $localize`Change quota, role, and more.`,
            linkBuilder: ({ user }) => this.getRouterUserEditLink(user)
          },
          {
            label: $localize`Delete user`,
            description: $localize`Videos will be deleted, comments will be tombstoned.`,
            handler: ({ user }) => this.removeUser(user)
          },
          {
            label: $localize`Ban`,
            description: $localize`User won't be able to login anymore, but videos and comments will be kept as is.`,
            handler: ({ user }) => this.openBanUserModal(user),
            isDisplayed: ({ user }) => !user.blocked
          },
          {
            label: $localize`Unban user`,
            description: $localize`Allow the user to login and create videos/comments again`,
            handler: ({ user }) => this.unbanUser(user),
            isDisplayed: ({ user }) => user.blocked
          },
          {
            label: $localize`Set Email as Verified`,
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
            label: $localize`Mute this account`,
            description: $localize`Hide any content from that user from you.`,
            isDisplayed: ({ account }) => account.mutedByUser === false,
            handler: ({ account }) => this.blockAccountByUser(account)
          },
          {
            label: $localize`Unmute this account`,
            description: $localize`Show back content from that user for you.`,
            isDisplayed: ({ account }) => account.mutedByUser === true,
            handler: ({ account }) => this.unblockAccountByUser(account)
          },
          {
            label: $localize`Mute the instance`,
            description: $localize`Hide any content from that instance for you.`,
            isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === false,
            handler: ({ account }) => this.blockServerByUser(account.host)
          },
          {
            label: $localize`Unmute the instance`,
            description: $localize`Show back content from that instance for you.`,
            isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === true,
            handler: ({ account }) => this.unblockServerByUser(account.host)
          },
          {
            label: $localize`Remove comments from your videos`,
            description: $localize`Remove comments made by this account on your videos.`,
            handler: ({ account }) => this.bulkRemoveCommentsOf({ accountName: account.nameWithHost, scope: 'my-videos' })
          }
        ])

        let instanceActions: DropdownAction<{ user: User, account: Account }>[] = []

        // Instance actions on account blocklists
        if (authUser.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
          instanceActions = instanceActions.concat([
            {
              label: $localize`Mute this account by your instance`,
              description: $localize`Hide any content from that user from you, your instance and its users.`,
              isDisplayed: ({ account }) => account.mutedByInstance === false,
              handler: ({ account }) => this.blockAccountByInstance(account)
            },
            {
              label: $localize`Unmute this account by your instance`,
              description: $localize`Show this user's content to the users of this instance again.`,
              isDisplayed: ({ account }) => account.mutedByInstance === true,
              handler: ({ account }) => this.unblockAccountByInstance(account)
            }
          ])
        }

        // Instance actions on server blocklists
        if (authUser.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
          instanceActions = instanceActions.concat([
            {
              label: $localize`Mute the instance by your instance`,
              description: $localize`Hide any content from that instance from you, your instance and its users.`,
              isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === false,
              handler: ({ account }) => this.blockServerByInstance(account.host)
            },
            {
              label: $localize`Unmute the instance by your instance`,
              description: $localize`Show back content from that instance for you, your instance and its users.`,
              isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === true,
              handler: ({ account }) => this.unblockServerByInstance(account.host)
            }
          ])
        }

        if (authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)) {
          instanceActions = instanceActions.concat([
            {
              label: $localize`Remove comments from your instance`,
              description: $localize`Remove comments made by this account from your instance.`,
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
