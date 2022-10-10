import { Subscription } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { AuthService, Notifier, ScreenService, ServerService, User, UserService } from '@app/core'
import {
  USER_EMAIL_VALIDATOR,
  USER_ROLE_VALIDATOR,
  USER_VIDEO_QUOTA_DAILY_VALIDATOR,
  USER_VIDEO_QUOTA_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactiveService } from '@app/shared/shared-forms'
import { TwoFactorService, UserAdminService } from '@app/shared/shared-users'
import { User as UserType, UserAdminFlag, UserRole, UserUpdate } from '@shared/models'
import { UserEdit } from './user-edit'

@Component({
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
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
          this.router.navigate([ '/admin/users/list' ])
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
      role: userJson.role.toString(),
      videoQuota: userJson.videoQuota,
      videoQuotaDaily: userJson.videoQuotaDaily,
      pluginAuth: userJson.pluginAuth,
      byPassAutoBlock: userJson.adminFlags & UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
    })
  }
}
