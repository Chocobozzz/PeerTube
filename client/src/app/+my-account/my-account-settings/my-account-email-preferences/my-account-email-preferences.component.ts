import { Component, OnInit, inject, model } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, UserService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeerTubeTemplateDirective } from '@app/shared/shared-main/common/peertube-template.directive'
import { User, UserUpdateMe } from '@peertube/peertube-models'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'

@Component({
  selector: 'my-account-email-preferences',
  templateUrl: './my-account-email-preferences.component.html',
  styleUrls: [ './my-account-email-preferences.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, PeertubeCheckboxComponent, PeerTubeTemplateDirective ]
})
export class MyAccountEmailPreferencesComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  readonly user = model<User>(undefined)

  checkboxLabel: string

  ngOnInit () {
    this.buildForm({
      'email-public': null
    })

    this.form.patchValue({ 'email-public': this.user().emailPublic })

    this.checkboxLabel = $localize``
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

          this.user.update(u => ({ ...u, emailPublic: details.emailPublic }))
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
