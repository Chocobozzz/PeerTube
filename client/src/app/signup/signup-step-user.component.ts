import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { AuthService } from '@app/core'
import { FormReactive, UserValidatorsService } from '../shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-signup-step-user',
  templateUrl: './signup-step-user.component.html',
  styleUrls: [ './signup.component.scss' ]
})
export class SignupStepUserComponent extends FormReactive implements OnInit {
  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private userValidatorsService: UserValidatorsService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      username: this.userValidatorsService.USER_USERNAME,
      password: this.userValidatorsService.USER_PASSWORD,
      email: this.userValidatorsService.USER_EMAIL,
      terms: this.userValidatorsService.USER_TERMS
    })

    setTimeout(() => this.formBuilt.emit(this.form))
  }
}
