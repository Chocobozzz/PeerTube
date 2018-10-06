import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '../../../core'
import { UserEdit } from './user-edit'
import { User, UserUpdate } from '../../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { UserService } from '@app/shared'

@Component({
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserUpdateComponent extends UserEdit implements OnInit, OnDestroy {
  error: string
  userId: number
  username: string

  private paramsSub: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    protected serverService: ServerService,
    protected configService: ConfigService,
    private userValidatorsService: UserValidatorsService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()

    this.buildQuotaOptions()
  }

  ngOnInit () {
    const defaultValues = { videoQuota: '-1', videoQuotaDaily: '-1' }
    this.buildForm({
      email: this.userValidatorsService.USER_EMAIL,
      role: this.userValidatorsService.USER_ROLE,
      videoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
      videoQuotaDaily: this.userValidatorsService.USER_VIDEO_QUOTA_DAILY
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

    // A select in HTML is always mapped as a string, we convert it to number
    userUpdate.videoQuota = parseInt(this.form.value['videoQuota'], 10)
    userUpdate.videoQuotaDaily = parseInt(this.form.value['videoQuotaDaily'], 10)

    this.userService.updateUser(this.userId, userUpdate).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('User {{username}} updated.', { username: this.username })
        )
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return this.i18n('Update user')
  }

  private onUserFetched (userJson: User) {
    this.userId = userJson.id
    this.username = userJson.username

    this.form.patchValue({
      email: userJson.email,
      role: userJson.role,
      videoQuota: userJson.videoQuota,
      videoQuotaDaily: userJson.videoQuotaDaily
    })
  }
}
