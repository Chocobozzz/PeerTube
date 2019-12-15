import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { AuthService } from '@app/core'
import { FormReactive, UserService, UserValidatorsService } from '@app/shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { FormGroup } from '@angular/forms'
import { pairwise } from 'rxjs/operators'
import { concat, of } from 'rxjs'

@Component({
  selector: 'my-register-step-user',
  templateUrl: './register-step-user.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterStepUserComponent extends FormReactive implements OnInit {
  @Input() hasCodeOfConduct = false

  @Output() formBuilt = new EventEmitter<FormGroup>()
  @Output() termsClick = new EventEmitter<void>()
  @Output() codeOfConductClick = new EventEmitter<void>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private userService: UserService,
    private userValidatorsService: UserValidatorsService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      displayName: this.userValidatorsService.USER_DISPLAY_NAME_REQUIRED,
      username: this.userValidatorsService.USER_USERNAME,
      password: this.userValidatorsService.USER_PASSWORD,
      email: this.userValidatorsService.USER_EMAIL,
      terms: this.userValidatorsService.USER_TERMS
    })

    setTimeout(() => this.formBuilt.emit(this.form))

    concat(
      of(''),
      this.form.get('displayName').valueChanges
    ).pipe(pairwise())
     .subscribe(([ oldValue, newValue ]) => this.onDisplayNameChange(oldValue, newValue))
  }

  onTermsClick (event: Event) {
    event.preventDefault()
    this.termsClick.emit()
  }

  onCodeOfConductClick (event: Event) {
    event.preventDefault()
    this.codeOfConductClick.emit()
  }

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const username = this.form.value['username'] || ''

    const newUsername = this.userService.getNewUsername(oldDisplayName, newDisplayName, username)
    this.form.patchValue({ username: newUsername })
  }
}
