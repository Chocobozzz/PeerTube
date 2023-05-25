import { Subject } from 'rxjs'
import { Component, Input, OnInit } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { User, UserUpdateMe } from '@shared/models'

@Component({
  selector: 'my-account-email-preferences',
  templateUrl: './my-account-email-preferences.component.html',
  styleUrls: [ './my-account-email-preferences.component.scss' ]
})
export class MyAccountEmailPreferencesComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  constructor (
    protected formReactiveService: FormReactiveService,
    private userService: UserService,
    private notifier: Notifier
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'email-public': null
    })

    this.userInformationLoaded.subscribe(() => {
      this.form.patchValue({ 'email-public': this.user.emailPublic })
    })
  }

  updateEmailPublic () {
    const details: UserUpdateMe = {
      emailPublic: this.form.value['email-public']
    }

    this.userService.updateMyProfile(details)
      .subscribe({
        next: () => {
          if (details.emailPublic) this.notifier.success($localize`Email is now public`)
          else this.notifier.success($localize`Email is now private`)

          this.user.emailPublic = details.emailPublic
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
