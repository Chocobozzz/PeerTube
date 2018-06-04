import { Component, Input, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, USER_DESCRIPTION, USER_DISPLAY_NAME, UserService } from '../../../shared'
import { User } from '@app/shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-account-profile',
  templateUrl: './my-account-profile.component.html',
  styleUrls: [ './my-account-profile.component.scss' ]
})
export class MyAccountProfileComponent extends FormReactive implements OnInit {
  @Input() user: User = null

  error: string = null

  form: FormGroup
  formErrors = {
    'display-name': '',
    'description': ''
  }
  validationMessages = {
    'display-name': USER_DISPLAY_NAME.MESSAGES,
    'description': USER_DESCRIPTION.MESSAGES
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
      'display-name': [ this.user.account.displayName, USER_DISPLAY_NAME.VALIDATORS ],
      'description': [ this.user.account.description, USER_DESCRIPTION.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  updateMyProfile () {
    const displayName = this.form.value['display-name']
    const description = this.form.value['description'] || null

    this.error = null

    this.userService.updateMyProfile({ displayName, description }).subscribe(
      () => {
        this.user.account.displayName = displayName
        this.user.account.description = description

        this.notificationsService.success(this.i18n('Success'), this.i18n('Profile updated.'))
      },

      err => this.error = err.message
    )
  }
}
