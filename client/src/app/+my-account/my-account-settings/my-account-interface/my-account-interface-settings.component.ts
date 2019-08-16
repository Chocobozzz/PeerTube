import { Component, Input, OnInit } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { UserUpdateMe } from '../../../../../../shared'
import { AuthService } from '../../../core'
import { FormReactive, User, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-account-interface-settings',
  templateUrl: './my-account-interface-settings.component.html',
  styleUrls: [ './my-account-interface-settings.component.scss' ]
})
export class MyAccountInterfaceSettingsComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  get availableThemes () {
    return this.serverService.getConfig().theme.registered
               .map(t => t.name)
  }

  ngOnInit () {
    this.buildForm({
      theme: null
    })

    this.userInformationLoaded
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user.theme
        })
      })
  }

  updateInterfaceSettings () {
    const theme = this.form.value['theme']

    const details: UserUpdateMe = {
      theme
    }

    this.userService.updateMyProfile(details).subscribe(
      () => {
        this.authService.refreshUserInformation()

        this.notifier.success(this.i18n('Interface settings updated.'))
      },

      err => this.notifier.error(err.message)
    )
  }
}
