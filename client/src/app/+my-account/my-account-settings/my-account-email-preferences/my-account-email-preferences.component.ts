import { Component, Input, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, UserService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { User, UserUpdateMe } from '@peertube/peertube-models'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'

@Component({
  selector: 'my-account-email-preferences',
  templateUrl: './my-account-email-preferences.component.html',
  styleUrls: [ './my-account-email-preferences.component.scss' ],
  standalone: true,
  imports: [ FormsModule, ReactiveFormsModule, PeertubeCheckboxComponent ]
})
export class MyAccountEmailPreferencesComponent extends FormReactive implements OnInit {
  @Input() user: User

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

    this.form.patchValue({ 'email-public': this.user.emailPublic })
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
