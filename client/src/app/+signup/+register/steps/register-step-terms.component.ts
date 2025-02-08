import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { REGISTER_REASON_VALIDATOR, REGISTER_TERMS_VALIDATOR } from '../shared'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'my-register-step-terms',
  templateUrl: './register-step-terms.component.html',
  styleUrls: [ './step.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgIf, NgClass, PeertubeCheckboxComponent, PeerTubeTemplateDirective ]
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
