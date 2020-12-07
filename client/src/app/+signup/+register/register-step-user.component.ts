import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { UserService } from '@app/core'
import {
  USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
  USER_EMAIL_VALIDATOR,
  USER_PASSWORD_VALIDATOR,
  USER_USERNAME_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'

@Component({
  selector: 'my-register-step-user',
  templateUrl: './register-step-user.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterStepUserComponent extends FormReactive implements OnInit {
  @Input() videoUploadDisabled = false

  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private userService: UserService
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

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const username = this.form.value['username'] || ''

    const newUsername = this.userService.getNewUsername(oldDisplayName, newDisplayName, username)
    this.form.patchValue({ username: newUsername })
  }
}
