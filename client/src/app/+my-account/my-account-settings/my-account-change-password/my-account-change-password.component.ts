import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'
import { filter } from 'rxjs/operators'
import { AuthService } from '@app/core';
import { User } from '../../../../../../shared';

@Component({
  selector: 'my-account-change-password',
  templateUrl: './my-account-change-password.component.html',
  styleUrls: [ './my-account-change-password.component.scss' ]
})
export class MyAccountChangePasswordComponent extends FormReactive implements OnInit {
  error: string = null
  user: User = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private notificationsService: NotificationsService,
    private authService: AuthService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'old-password': this.userValidatorsService.USER_PASSWORD,
      'new-password': this.userValidatorsService.USER_PASSWORD,
      'new-confirmed-password': this.userValidatorsService.USER_CONFIRM_PASSWORD
    })

    this.user = this.authService.getUser()

    const confirmPasswordControl = this.form.get('new-confirmed-password')

    confirmPasswordControl.valueChanges
                          .pipe(filter(v => v !== this.form.value[ 'new-password' ]))
                          .subscribe(() => confirmPasswordControl.setErrors({ matchPassword: true }))
  }

  checkPassword () {
    this.error = null
    const oldPassword = this.form.value[ 'old-password' ];

    // compare old password
    this.authService.login(this.user.account.name, oldPassword)
      .subscribe(
        () => this.changePassword(),
        err => {
          if (err.message.indexOf('credentials are invalid') !== -1) this.error = this.i18n('Incorrect old password.')
          else this.error = err.message
        }
      )

  }

  private changePassword(){
    this.userService.changePassword(this.form.value[ 'new-password' ]).subscribe(
      () => {
        this.notificationsService.success(this.i18n('Success'), this.i18n('Password updated.'))

        this.form.reset()
      },

      err => this.error = err.message
    )
  }
}
