import { Component, OnDestroy, OnInit, Input } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import * as generator from 'generate-password-browser'
import { NotificationsService } from 'angular2-notifications'
import { UserService } from '@app/shared/users/user.service'
import { ServerService } from '../../../core'
import { User, UserUpdate } from '../../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { FormReactive } from '../../../shared'

@Component({
  selector: 'my-user-password',
  templateUrl: './user-password.component.html',
  styleUrls: [ './user-password.component.scss' ]
})
export class UserPasswordComponent extends FormReactive implements OnInit, OnDestroy {
  error: string
  username: string
  showPassword = false

  @Input() userId: number

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
  }

  ngOnInit () {
    this.buildForm({
      password: this.userValidatorsService.USER_PASSWORD
    })
  }

  ngOnDestroy () {
    //
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value

    this.userService.updateUser(this.userId, userUpdate).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Password changed for user {{username}}.', { username: this.username })
        )
      },

      err => this.error = err.message
    )
  }

  generatePassword () {
    this.form.patchValue({
      password: generator.generate({
        length: 16,
        excludeSimilarCharacters: true,
        strict: true
      })
    })
  }

  togglePasswordVisibility () {
    this.showPassword = !this.showPassword
  }

  getFormButtonTitle () {
    return this.i18n('Update user password')
  }

  private onUserFetched (userJson: User) {
    this.userId = userJson.id
    this.username = userJson.username
  }
}
