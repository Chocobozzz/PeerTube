import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input, output } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { REGISTER_REASON_VALIDATOR, REGISTER_TERMS_VALIDATOR } from '../shared'

@Component({
  selector: 'my-register-step-terms',
  templateUrl: './register-step-terms.component.html',
  styleUrls: [ './step.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, PeertubeCheckboxComponent, PeerTubeTemplateDirective ]
})
export class RegisterStepTermsComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)

  readonly hasCodeOfConduct = input(false)
  readonly requiresApproval = input<boolean>(undefined)
  readonly minimumAge = input(16)
  readonly instanceName = input<string>(undefined)

  readonly formBuilt = output<FormGroup>()
  readonly termsClick = output()
  readonly codeOfConductClick = output()

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      terms: REGISTER_TERMS_VALIDATOR,

      registrationReason: this.requiresApproval()
        ? REGISTER_REASON_VALIDATOR
        : null
    })

    setTimeout(() => this.formBuilt.emit(this.form))
  }

  onTermsClick (event: Event) {
    event.preventDefault()
    this.termsClick.emit()
  }

  onCodeOfConductClick (event: Event) {
    event.preventDefault()
    this.codeOfConductClick.emit()
  }
}
