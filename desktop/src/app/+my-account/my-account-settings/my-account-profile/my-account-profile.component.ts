import { Component, Input, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, UserService } from '../../../shared'
import { User } from '@app/shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { Subject } from 'rxjs'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'

@Component({
  selector: 'my-account-profile',
  templateUrl: './my-account-profile.component.html',
  styleUrls: [ './my-account-profile.component.scss' ]
})
export class MyAccountProfileComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

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
      'display-name': this.userValidatorsService.USER_DISPLAY_NAME,
      description: this.userValidatorsService.USER_DESCRIPTION
    })

    this.userInformationLoaded.subscribe(() => {
      this.form.patchValue({
        'display-name': this.user.account.displayName,
        description: this.user.account.description
      })
    })
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
