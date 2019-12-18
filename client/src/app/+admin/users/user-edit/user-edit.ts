import { AuthService, ServerService } from '../../../core'
import { FormReactive } from '../../../shared'
import { ServerConfig, USER_ROLE_LABELS, UserRole, VideoResolution } from '../../../../../../shared'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { UserAdminFlag } from '@shared/models/users/user-flag.model'
import { OnInit } from '@angular/core'

export abstract class UserEdit extends FormReactive implements OnInit {
  videoQuotaOptions: { value: string, label: string }[] = []
  videoQuotaDailyOptions: { value: string, label: string }[] = []
  username: string
  userId: number

  protected serverConfig: ServerConfig

  protected abstract serverService: ServerService
  protected abstract configService: ConfigService
  protected abstract auth: AuthService
  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)
  }

  getRoles () {
    const authUser = this.auth.getUser()

    if (authUser.role === UserRole.ADMINISTRATOR) {
      return Object.keys(USER_ROLE_LABELS)
            .map(key => ({ value: key.toString(), label: USER_ROLE_LABELS[key] }))
    }

    return [
      { value: UserRole.USER.toString(), label: USER_ROLE_LABELS[UserRole.USER] }
    ]
  }

  isTranscodingInformationDisplayed () {
    const formVideoQuota = parseInt(this.form.value['videoQuota'], 10)

    return this.serverConfig.transcoding.enabledResolutions.length !== 0 &&
           formVideoQuota > 0
  }

  computeQuotaWithTranscoding () {
    const transcodingConfig = this.serverConfig.transcoding

    const resolutions = transcodingConfig.enabledResolutions
    const higherResolution = VideoResolution.H_4K
    let multiplier = 0

    for (const resolution of resolutions) {
      multiplier += resolution / higherResolution
    }

    if (transcodingConfig.hls.enabled) multiplier *= 2

    return multiplier * parseInt(this.form.value['videoQuota'], 10)
  }

  resetPassword () {
    return
  }

  protected buildAdminFlags (formValue: any) {
    return formValue.byPassAutoBlacklist ? UserAdminFlag.BY_PASS_VIDEO_AUTO_BLACKLIST : UserAdminFlag.NONE
  }

  protected buildQuotaOptions () {
    // These are used by a HTML select, so convert key into strings
    this.videoQuotaOptions = this.configService
                                 .videoQuotaOptions.map(q => ({ value: q.value.toString(), label: q.label }))

    this.videoQuotaDailyOptions = this.configService
                                      .videoQuotaDailyOptions.map(q => ({ value: q.value.toString(), label: q.label }))
  }
}
