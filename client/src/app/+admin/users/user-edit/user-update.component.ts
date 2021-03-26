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
import { FormValidatorService } from '@app/shared/shared-forms'
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
    protected formValidatorService: FormValidatorService,
    protected serverService: ServerService,
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
      this.userService.getUser(userId, true).subscribe(
        user => this.onUserFetched(user),

        err => this.error = err.message
      )
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

    this.userService.updateUser(this.user.id, userUpdate).subscribe(
      () => {
        this.notifier.success($localize`User ${this.user.username} updated.`)
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.message
    )
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
    this.userService.askResetPassword(this.user.email).subscribe(
      () => {
        this.notifier.success($localize`An email asking for password reset has been sent to ${this.user.username}.`)
      },

      err => this.error = err.message
    )
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
