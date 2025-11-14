import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input, output } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { SignupService } from '@app/+signup/shared/signup.service'
import { ServerService } from '@app/core'
import {
  USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
  USER_EMAIL_VALIDATOR,
  USER_USERNAME_VALIDATOR,
  getUserNewPasswordValidator
} from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { InputTextComponent } from '../../../shared/shared-forms/input-text.component'

@Component({
  selector: 'my-register-step-user',
  templateUrl: './register-step-user.component.html',
  styleUrls: [ './step.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, InputTextComponent, AlertComponent ]
})
export class RegisterStepUserComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private signupService = inject(SignupService)
  private serverService = inject(ServerService)

  readonly videoUploadDisabled = input(false)
  readonly requiresEmailVerification = input(false)

  readonly formBuilt = output<FormGroup>()

  minPasswordLengthMessage: string

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    const passwordConstraints = this.serverService.getHTMLConfig().fieldsConstraints.users.password
    const passwordValidator = getUserNewPasswordValidator(passwordConstraints.minLength, passwordConstraints.maxLength)

    this.minPasswordLengthMessage = passwordValidator.MESSAGES.minlength

    this.buildForm({
      displayName: USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
      username: USER_USERNAME_VALIDATOR,
      password: passwordValidator,
      email: USER_EMAIL_VALIDATOR
    })

    setTimeout(() => this.formBuilt.emit(this.form))

    concat(
      of(''),
      this.form.get('displayName').valueChanges
    ).pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => this.onDisplayNameChange(oldValue, newValue))
  }

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const username = this.form.value['username'] || ''

    const newUsername = this.signupService.getNewUsername(oldDisplayName, newDisplayName, username)
    this.form.patchValue({ username: newUsername })
  }
}
