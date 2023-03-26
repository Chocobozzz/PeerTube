import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { REGISTER_REASON_VALIDATOR, REGISTER_TERMS_VALIDATOR } from '../shared'

@Component({
  selector: 'my-register-step-terms',
  templateUrl: './register-step-terms.component.html',
  styleUrls: [ './step.component.scss' ]
})
export class RegisterStepTermsComponent extends FormReactive implements OnInit {
  @Input() hasCodeOfConduct = false
  @Input() requiresApproval: boolean
  @Input() minimumAge = 16
  @Input() instanceName: string

  @Output() formBuilt = new EventEmitter<FormGroup>()
  @Output() termsClick = new EventEmitter<void>()
  @Output() codeOfConductClick = new EventEmitter<void>()

  constructor (
    protected formReactiveService: FormReactiveService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      terms: REGISTER_TERMS_VALIDATOR,

      registrationReason: this.requiresApproval
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
