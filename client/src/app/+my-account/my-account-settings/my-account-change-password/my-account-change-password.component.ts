import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, USER_PASSWORD, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-account-change-password',
  templateUrl: './my-account-change-password.component.html',
  styleUrls: [ './my-account-change-password.component.scss' ]
})
export class MyAccountChangePasswordComponent extends FormReactive implements OnInit {
  error: string = null

  form: FormGroup
  formErrors = {
    'new-password': '',
    'new-confirmed-password': ''
  }
  validationMessages = {
    'new-password': USER_PASSWORD.MESSAGES,
    'new-confirmed-password': USER_PASSWORD.MESSAGES
  }

  constructor (
    private formBuilder: FormBuilder,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      'new-password': [ '', USER_PASSWORD.VALIDATORS ],
      'new-confirmed-password': [ '', USER_PASSWORD.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
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
