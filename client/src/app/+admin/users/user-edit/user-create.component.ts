import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import {
  USER_CHANNEL_NAME_VALIDATOR,
  USER_EMAIL_VALIDATOR,
  USER_PASSWORD_OPTIONAL_VALIDATOR,
  USER_PASSWORD_VALIDATOR,
  USER_ROLE_VALIDATOR,
  USER_USERNAME_VALIDATOR,
  USER_VIDEO_QUOTA_DAILY_VALIDATOR,
  USER_VIDEO_QUOTA_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { UserCreate, UserRole } from '@shared/models'
import { UserEdit } from './user-edit'

@Component({
  selector: 'my-user-create',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserCreateComponent extends UserEdit implements OnInit {
  error: string

  constructor (
    protected serverService: ServerService,
    protected formValidatorService: FormValidatorService,
    protected configService: ConfigService,
    protected screenService: ScreenService,
    protected auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private notifier: Notifier,
    private userService: UserService
    ) {
    super()

    this.buildQuotaOptions()
  }

  ngOnInit () {
    super.ngOnInit()

    const defaultValues = {
      role: UserRole.USER.toString(),
      videoQuota: -1,
      videoQuotaDaily: -1
    }

    this.buildForm({
      username: USER_USERNAME_VALIDATOR,
      channelName: USER_CHANNEL_NAME_VALIDATOR,
      email: USER_EMAIL_VALIDATOR,
      password: this.isPasswordOptional() ? USER_PASSWORD_OPTIONAL_VALIDATOR : USER_PASSWORD_VALIDATOR,
      role: USER_ROLE_VALIDATOR,
      videoQuota: USER_VIDEO_QUOTA_VALIDATOR,
      videoQuotaDaily: USER_VIDEO_QUOTA_DAILY_VALIDATOR,
      byPassAutoBlock: null
    }, defaultValues)
  }

  formValidated () {
    this.error = undefined

    const userCreate: UserCreate = this.form.value

    userCreate.adminFlags = this.buildAdminFlags(this.form.value)

    // A select in HTML is always mapped as a string, we convert it to number
    userCreate.videoQuota = parseInt(this.form.value['videoQuota'], 10)
    userCreate.videoQuotaDaily = parseInt(this.form.value['videoQuotaDaily'], 10)

    this.userService.addUser(userCreate).subscribe(
      () => {
        this.notifier.success($localize`User ${userCreate.username} created.`)
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return true
  }

  isPasswordOptional () {
    const serverConfig = this.route.snapshot.data.serverConfig
    return serverConfig.email.enabled
  }

  getFormButtonTitle () {
    return $localize`Create user`
  }
}
