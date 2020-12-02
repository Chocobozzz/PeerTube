import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import {
  USER_TERMS_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'

@Component({
  selector: 'my-register-step-terms',
  templateUrl: './register-step-terms.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterStepTermsComponent extends FormReactive implements OnInit {
  @Input() hasCodeOfConduct = false

  @Output() formBuilt = new EventEmitter<FormGroup>()
  @Output() termsClick = new EventEmitter<void>()
  @Output() codeOfConductClick = new EventEmitter<void>()

  constructor (
    protected formValidatorService: FormValidatorService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      terms: USER_TERMS_VALIDATOR
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
