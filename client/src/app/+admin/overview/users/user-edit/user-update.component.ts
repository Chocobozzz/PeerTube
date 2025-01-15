import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, Notifier, ScreenService, ServerService, User, UserService } from '@app/core'
import {
  USER_EMAIL_VALIDATOR,
  USER_ROLE_VALIDATOR,
  USER_VIDEO_QUOTA_DAILY_VALIDATOR,
  USER_VIDEO_QUOTA_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { TwoFactorService } from '@app/shared/shared-users/two-factor.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { UserAdminFlag, UserRole, User as UserType, UserUpdate } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
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
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ],
  standalone: true,
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
export class UserUpdateComponent extends UserEdit implements OnInit, OnDestroy {
  error: string

  private paramsSub: Subscription

  constructor (
    protected formReactiveService: FormReactiveService,
    protected serverService: ServerService,
    protected configService: ConfigService,
    protected screenService: ScreenService,
    protected auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private notifier: Notifier,
    private userService: UserService,
    private twoFactorService: TwoFactorService,
    private userAdminService: UserAdminService
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
      email: USER_EMAIL_VALIDATOR,
      role: USER_ROLE_VALIDATOR,
      videoQuota: USER_VIDEO_QUOTA_VALIDATOR,
      videoQuotaDaily: USER_VIDEO_QUOTA_DAILY_VALIDATOR,
      byPassAutoBlock: null,
      pluginAuth: null
    }, defaultValues)

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const userId = routeParams['id']
      this.userService.getUser(userId, true)
        .subscribe({
          next: user => this.onUserFetched(user),

          error: err => {
            this.error = err.message
          }
        })
    })
  }

  ngOnDestroy () {
    this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value
    userUpdate.adminFlags = this.buildAdminFlags(this.form.value)

    // A select in HTML is always mapped as a string, we convert it to number
    userUpdate.videoQuota = parseInt(this.form.value['videoQuota'], 10)
    userUpdate.videoQuotaDaily = parseInt(this.form.value['videoQuotaDaily'], 10)

    if (userUpdate.pluginAuth === 'null') userUpdate.pluginAuth = null

    this.userAdminService.updateUser(this.user.id, userUpdate)
      .subscribe({
        next: () => {
          this.notifier.success($localize`User ${this.user.username} updated.`)
          this.router.navigate([ '/admin/overview/users/list' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  isCreation () {
    return false
  }

  isPasswordOptional () {
    return false
  }

  getFormButtonTitle () {
    return $localize`Update user`
  }

  resetPassword () {
    this.userService.askResetPassword(this.user.email)
      .subscribe({
        next: () => {
          this.notifier.success($localize`An email asking for password reset has been sent to ${this.user.username}.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  disableTwoFactorAuth () {
    this.twoFactorService.disableTwoFactor({ userId: this.user.id })
      .subscribe({
        next: () => {
          this.user.twoFactorEnabled = false

          this.notifier.success($localize`Two factor authentication of ${this.user.username} disabled.`)
        },

        error: err => this.notifier.error(err.message)
      })

  }

  private onUserFetched (userJson: UserType) {
    this.user = new User(userJson)

    this.form.patchValue({
      email: userJson.email,
      role: userJson.role.id.toString(),
      videoQuota: userJson.videoQuota,
      videoQuotaDaily: userJson.videoQuotaDaily,
      pluginAuth: userJson.pluginAuth,
      byPassAutoBlock: userJson.adminFlags & UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
    })
  }
}
