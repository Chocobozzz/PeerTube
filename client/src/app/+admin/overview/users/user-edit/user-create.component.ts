import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, Notifier, ScreenService, ServerService } from '@app/core'
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
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { UserCreate, UserRole } from '@peertube/peertube-models'
import { ActorAvatarEditComponent } from '../../../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { InputTextComponent } from '../../../../shared/shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../../shared/shared-forms/select/select-custom-value.component'
import { HelpComponent } from '../../../../shared/shared-main/buttons/help.component'
import { BytesPipe } from '../../../../shared/shared-main/common/bytes.pipe'
import { PeerTubeTemplateDirective } from '../../../../shared/shared-main/common/peertube-template.directive'
import { UserRealQuotaInfoComponent } from '../../../shared/user-real-quota-info.component'
import { UserEdit } from './user-edit'
import { UserPasswordComponent } from './user-password.component'

@Component({
  selector: 'my-user-create',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ],
  imports: [
    RouterLink,
    NgIf,
    NgTemplateOutlet,
    ActorAvatarEditComponent,
    FormsModule,
    ReactiveFormsModule,
    NgClass,
    HelpComponent,
    PeerTubeTemplateDirective,
    InputTextComponent,
    NgFor,
    SelectCustomValueComponent,
    UserRealQuotaInfoComponent,
    PeertubeCheckboxComponent,
    UserPasswordComponent,
    BytesPipe,
    AlertComponent
  ]
})
export class UserCreateComponent extends UserEdit implements OnInit {
  error: string

  constructor (
    protected serverService: ServerService,
    protected formReactiveService: FormReactiveService,
    protected configService: ConfigService,
    protected screenService: ScreenService,
    protected auth: AuthService,
    private router: Router,
    private notifier: Notifier,
    private userAdminService: UserAdminService
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
