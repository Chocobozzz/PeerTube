import { CommonModule, NgTemplateOutlet } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthService, Notifier, ScreenService, ServerService } from '@app/core'
import {
  USER_CHANNEL_NAME_VALIDATOR,
  USER_EMAIL_VALIDATOR,
  USER_ROLE_VALIDATOR,
  USER_USERNAME_VALIDATOR,
  USER_VIDEO_QUOTA_DAILY_VALIDATOR,
  USER_VIDEO_QUOTA_VALIDATOR,
  getUserNewPasswordOptionalValidator,
  getUserNewPasswordValidator
} from '@app/shared/form-validators/user-validators'
import { AdminConfigService } from '@app/shared/shared-admin/admin-config.service'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { AccountTokenSessionsComponent } from '@app/shared/shared-users/account-token-sessions.component'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { UserCreate, UserRole } from '@peertube/peertube-models'
import { ActorAvatarEditComponent } from '../../../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { InputTextComponent } from '../../../../shared/shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../../shared/shared-forms/select/select-custom-value.component'
import { BytesPipe } from '../../../../shared/shared-main/common/bytes.pipe'
import { UserRealQuotaInfoComponent } from '../../../shared/user-real-quota-info.component'
import { UserEdit } from './user-edit'
import { UserPasswordComponent } from './user-password.component'

@Component({
  selector: 'my-user-create',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ],
  imports: [
    RouterLink,
    CommonModule,
    NgTemplateOutlet,
    ActorAvatarEditComponent,
    FormsModule,
    ReactiveFormsModule,
    InputTextComponent,
    SelectCustomValueComponent,
    UserRealQuotaInfoComponent,
    PeertubeCheckboxComponent,
    UserPasswordComponent,
    BytesPipe,
    AccountTokenSessionsComponent,
    AlertComponent
  ]
})
export class UserCreateComponent extends UserEdit implements OnInit {
  protected serverService = inject(ServerService)
  protected formReactiveService = inject(FormReactiveService)
  protected configService = inject(AdminConfigService)
  protected screenService = inject(ScreenService)
  protected auth = inject(AuthService)
  private router = inject(Router)
  private notifier = inject(Notifier)
  private userAdminService = inject(UserAdminService)

  error: string

  constructor () {
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

    const passwordConstraints = this.serverService.getHTMLConfig().fieldsConstraints.users.password

    this.buildForm({
      username: USER_USERNAME_VALIDATOR,
      channelName: USER_CHANNEL_NAME_VALIDATOR,
      email: USER_EMAIL_VALIDATOR,

      password: this.isPasswordOptional()
        ? getUserNewPasswordOptionalValidator(passwordConstraints.minLength, passwordConstraints.maxLength)
        : getUserNewPasswordValidator(passwordConstraints.minLength, passwordConstraints.maxLength),

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

    this.userAdminService.addUser(userCreate)
      .subscribe({
        next: () => {
          this.notifier.success($localize`User ${userCreate.username} created.`)
          this.router.navigate([ '/admin/overview/users/list' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  isCreation () {
    return true
  }

  isPasswordOptional () {
    return this.serverConfig.email.enabled
  }

  getFormButtonTitle () {
    return $localize`Create user`
  }
}
