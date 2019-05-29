import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { AuthService } from '@app/core'
import { FormReactive, UserValidatorsService } from '@app/shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-register-step-user',
  templateUrl: './register-step-user.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterStepUserComponent extends FormReactive implements OnInit {
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
