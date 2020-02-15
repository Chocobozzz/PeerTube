import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { AuthService, Notifier } from '@app/core'
import { ServerService } from '../../../core'
import { UserEdit } from './user-edit'
import { User, UserUpdate } from '../../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { UserService } from '@app/shared'
import { UserAdminFlag } from '@shared/models/users/user-flag.model'

@Component({
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserUpdateComponent extends UserEdit implements OnInit, OnDestroy {
  error: string
  userId: number
  userEmail: string
  username: string

  private paramsSub: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    protected serverService: ServerService,
    protected configService: ConfigService,
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

    const defaultValues = { videoQuota: '-1', videoQuotaDaily: '-1' }
    this.buildForm({
      email: this.userValidatorsService.USER_EMAIL,
      role: this.userValidatorsService.USER_ROLE,
      videoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
      videoQuotaDaily: this.userValidatorsService.USER_VIDEO_QUOTA_DAILY,
      byPassAutoBlacklist: null
    }, defaultValues)

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const userId = routeParams['id']
      this.userService.getUser(userId).subscribe(
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

    this.userService.updateUser(this.userId, userUpdate).subscribe(
      () => {
        this.notifier.success(this.i18n('User {{username}} updated.', { username: this.username }))
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
    return this.i18n('Update user')
  }

  resetPassword () {
    this.userService.askResetPassword(this.userEmail).subscribe(
      () => {
        this.notifier.success(
          this.i18n('An email asking for password reset has been sent to {{username}}.', { username: this.username })
        )
      },

      err => this.error = err.message
    )
  }

  private onUserFetched (userJson: User) {
    this.userId = userJson.id
    this.username = userJson.username
    this.userEmail = userJson.email

    this.form.patchValue({
      email: userJson.email,
      role: userJson.role,
      videoQuota: userJson.videoQuota,
      videoQuotaDaily: userJson.videoQuotaDaily,
      byPassAutoBlacklist: userJson.adminFlags & UserAdminFlag.BY_PASS_VIDEO_AUTO_BLACKLIST
    })
  }
}
