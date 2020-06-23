import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
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
    private userValidatorsService: UserValidatorsService,
    private route: ActivatedRoute,
    private router: Router,
    private notifier: Notifier,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()

    this.buildQuotaOptions()
  }

  ngOnInit () {
    super.ngOnInit()

    const defaultValues = {
      role: UserRole.USER.toString(),
      videoQuota: '-1',
      videoQuotaDaily: '-1'
    }

    this.buildForm({
      username: this.userValidatorsService.USER_USERNAME,
      email: this.userValidatorsService.USER_EMAIL,
      password: this.isPasswordOptional() ? this.userValidatorsService.USER_PASSWORD_OPTIONAL : this.userValidatorsService.USER_PASSWORD,
      role: this.userValidatorsService.USER_ROLE,
      videoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
      videoQuotaDaily: this.userValidatorsService.USER_VIDEO_QUOTA_DAILY,
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
        this.notifier.success(this.i18n('User {{username}} created.', { username: userCreate.username }))
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
    return this.i18n('Create user')
  }
}
