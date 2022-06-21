import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import {
  USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
  USER_EMAIL_VALIDATOR,
  USER_PASSWORD_VALIDATOR,
  USER_USERNAME_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { UserSignupService } from '@app/shared/shared-users'

@Component({
  selector: 'my-register-step-user',
  templateUrl: './register-step-user.component.html',
  styleUrls: [ './step.component.scss' ]
})
export class RegisterStepUserComponent extends FormReactive implements OnInit {
  @Input() videoUploadDisabled = false
  @Input() requiresEmailVerification = false

  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private userSignupService: UserSignupService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      displayName: USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
      username: USER_USERNAME_VALIDATOR,
      password: USER_PASSWORD_VALIDATOR,
      email: USER_EMAIL_VALIDATOR
    })

    setTimeout(() => this.formBuilt.emit(this.form))

    concat(
      of(''),
      this.form.get('displayName').valueChanges
    ).pipe(pairwise())
     .subscribe(([ oldValue, newValue ]) => this.onDisplayNameChange(oldValue, newValue))
  }

  getMinPasswordLengthMessage () {
    return USER_PASSWORD_VALIDATOR.MESSAGES.minlength
  }

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const username = this.form.value['username'] || ''

    const newUsername = this.userSignupService.getNewUsername(oldDisplayName, newDisplayName, username)
    this.form.patchValue({ username: newUsername })
  }
}
