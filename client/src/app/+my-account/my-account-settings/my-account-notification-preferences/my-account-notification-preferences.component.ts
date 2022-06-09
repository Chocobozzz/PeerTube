import { debounce } from 'lodash-es'
import { Subject } from 'rxjs'
import { Component, Input, OnInit } from '@angular/core'
import { Notifier, ServerService, User } from '@app/core'
import { UserNotificationService } from '@app/shared/shared-main'
import { UserNotificationSetting, UserNotificationSettingValue, UserRight } from '@shared/models'

@Component({
  selector: 'my-account-notification-preferences',
  templateUrl: './my-account-notification-preferences.component.html',
  styleUrls: [ './my-account-notification-preferences.component.scss' ]
})
export class MyAccountNotificationPreferencesComponent implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  notificationSettingKeys: (keyof UserNotificationSetting)[] = []
  emailNotifications: { [ id in keyof UserNotificationSetting ]: boolean } = {} as any
  webNotifications: { [ id in keyof UserNotificationSetting ]: boolean } = {} as any
  labelNotifications: { [ id in keyof UserNotificationSetting ]: string } = {} as any
  rightNotifications: { [ id in keyof Partial<UserNotificationSetting> ]: UserRight } = {} as any
  emailEnabled = false

  private savePreferences = debounce(this.savePreferencesImpl.bind(this), 500)

  constructor (
    private userNotificationService: UserNotificationService,
    private serverService: ServerService,
    private notifier: Notifier
  ) {
    this.labelNotifications = {
      newVideoFromSubscription: $localize`New video from your subscriptions`,
      newCommentOnMyVideo: $localize`New comment on your video`,
      abuseAsModerator: $localize`New abuse`,
      videoAutoBlacklistAsModerator: $localize`Video blocked automatically waiting review`,
      blacklistOnMyVideo: $localize`One of your video is blocked/unblocked`,
      myVideoPublished: $localize`Video published (after transcoding/scheduled update)`,
      myVideoImportFinished: $localize`Video import finished`,
      newUserRegistration: $localize`A new user registered on your instance`,
      newFollow: $localize`You or your channel(s) has a new follower`,
      commentMention: $localize`Someone mentioned you in video comments`,
      newInstanceFollower: $localize`Your instance has a new follower`,
      autoInstanceFollowing: $localize`Your instance automatically followed another instance`,
      abuseNewMessage: $localize`An abuse report received a new message`,
      abuseStateChange: $localize`One of your abuse reports has been accepted or rejected by moderators`,
      newPeerTubeVersion: $localize`A new PeerTube version is available`,
      newPluginVersion: $localize`One of your plugin/theme has a new available version`
    }
    this.notificationSettingKeys = Object.keys(this.labelNotifications) as (keyof UserNotificationSetting)[]

    this.rightNotifications = {
      abuseAsModerator: UserRight.MANAGE_ABUSES,
      videoAutoBlacklistAsModerator: UserRight.MANAGE_VIDEO_BLACKLIST,
      newUserRegistration: UserRight.MANAGE_USERS,
      newInstanceFollower: UserRight.MANAGE_SERVER_FOLLOW,
      autoInstanceFollowing: UserRight.MANAGE_CONFIGURATION,
      newPeerTubeVersion: UserRight.MANAGE_DEBUG,
      newPluginVersion: UserRight.MANAGE_DEBUG
    }
  }

  ngOnInit () {
    const serverConfig = this.serverService.getHTMLConfig()
    this.emailEnabled = serverConfig.email.enabled

    this.userInformationLoaded.subscribe(() => this.loadNotificationSettings())
  }

  hasUserRight (field: keyof UserNotificationSetting) {
    const rightToHave = this.rightNotifications[field]
    if (!rightToHave) return true // No rights needed

    return this.user.hasRight(rightToHave)
  }

  updateEmailSetting (field: keyof UserNotificationSetting, value: boolean) {
    if (value === true) this.user.notificationSettings[field] |= UserNotificationSettingValue.EMAIL
    else this.user.notificationSettings[field] &= ~UserNotificationSettingValue.EMAIL

    this.savePreferences()
  }

  updateWebSetting (field: keyof UserNotificationSetting, value: boolean) {
    if (value === true) this.user.notificationSettings[field] |= UserNotificationSettingValue.WEB
    else this.user.notificationSettings[field] &= ~UserNotificationSettingValue.WEB

    this.savePreferences()
  }

  private savePreferencesImpl () {
    this.userNotificationService.updateNotificationSettings(this.user.notificationSettings)
      .subscribe(
        () => {
          this.notifier.success($localize`Preferences saved`, undefined, 2000)
        },

        err => this.notifier.error(err.message)
      )
  }

  private loadNotificationSettings () {
    for (const key of Object.keys(this.user.notificationSettings)) {
      const value = this.user.notificationSettings[key]
      this.emailNotifications[key] = value & UserNotificationSettingValue.EMAIL

      this.webNotifications[key] = value & UserNotificationSettingValue.WEB
    }
  }
}
