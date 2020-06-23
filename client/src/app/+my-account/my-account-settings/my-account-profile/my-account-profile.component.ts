import { Subject } from 'rxjs'
import { Component, Input, OnInit } from '@angular/core'
import { Notifier, User, UserService } from '@app/core'
import { FormReactive, FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'

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
    private notifier: Notifier,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'display-name': this.userValidatorsService.USER_DISPLAY_NAME_REQUIRED,
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

        this.notifier.success(this.i18n('Profile updated.'))
      },

      err => this.error = err.message
    )
  }
}
