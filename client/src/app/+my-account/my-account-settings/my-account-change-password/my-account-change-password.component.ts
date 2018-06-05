import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'

@Component({
  selector: 'my-account-change-password',
  templateUrl: './my-account-change-password.component.html',
  styleUrls: [ './my-account-change-password.component.scss' ]
})
export class MyAccountChangePasswordComponent extends FormReactive implements OnInit {
  error: string = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'new-password': this.userValidatorsService.USER_PASSWORD,
      'new-confirmed-password': this.userValidatorsService.USER_PASSWORD
    })
  }

  changePassword () {
    const newPassword = this.form.value['new-password']
    const newConfirmedPassword = this.form.value['new-confirmed-password']

    this.error = null

    if (newPassword !== newConfirmedPassword) {
      this.error = this.i18n('The new password and the confirmed password do not correspond.')
      return
    }

    this.userService.changePassword(newPassword).subscribe(
      () => this.notificationsService.success(this.i18n('Success'), this.i18n('Password updated.')),

      err => this.error = err.message
    )
  }
}
