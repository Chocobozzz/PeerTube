import { Directive, OnInit } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, ScreenService, ServerService, User } from '@app/core'
import { peertubeTranslate, USER_ROLE_LABELS } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, UserAdminFlag, UserRole } from '@peertube/peertube-models'
import { SelectOptionsItem } from '../../../../../types/select-options-item.model'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class UserEdit extends FormReactive implements OnInit {
  videoQuotaOptions: SelectOptionsItem[] = []
  videoQuotaDailyOptions: SelectOptionsItem[] = []
  username: string
  user: User

  roles: { value: string, label: string }[] = []

  protected serverConfig: HTMLServerConfig

  protected abstract serverService: ServerService
  protected abstract configService: ConfigService
  protected abstract screenService: ScreenService
  protected abstract auth: AuthService
  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildRoles()
  }

  get subscribersCount () {
    const forAccount = this.user
      ? this.user.account.followersCount
      : 0
    const forChannels = this.user
      ? this.user.videoChannels.map(c => c.followersCount).reduce((a, b) => a + b, 0)
      : 0
    return forAccount + forChannels
  }

  getAuthPlugins () {
    return this.serverConfig.plugin.registeredIdAndPassAuths.map(p => p.npmName)
      .concat(this.serverConfig.plugin.registeredExternalAuths.map(p => p.npmName))
  }

  buildRoles () {
    const authUser = this.auth.getUser()

    this.serverService.getServerLocale()
      .subscribe(translations => {
        if (authUser.role.id === UserRole.ADMINISTRATOR) {
          this.roles = Object.entries(USER_ROLE_LABELS)
                .map(([ key, value ]) => ({ value: key.toString(), label: peertubeTranslate(value, translations) }))
          return
        }

        this.roles = [
          { value: UserRole.USER.toString(), label: peertubeTranslate(USER_ROLE_LABELS[UserRole.USER], translations) }
        ]
      })
  }

  displayDangerZone () {
    if (this.isCreation()) return false
    if (!this.user) return false
    if (this.user.pluginAuth) return false
    if (this.auth.getUser().id === this.user.id) return false

    return true
  }

  resetPassword () {
    return
  }

  disableTwoFactorAuth () {
    return
  }

  getUserVideoQuota () {
    return this.form.value['videoQuota']
  }

  protected buildAdminFlags (formValue: any) {
    return formValue.byPassAutoBlock ? UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST : UserAdminFlag.NONE
  }

  protected buildQuotaOptions () {
    this.videoQuotaOptions = this.configService.videoQuotaOptions
    this.videoQuotaDailyOptions = this.configService.videoQuotaDailyOptions
  }
}
