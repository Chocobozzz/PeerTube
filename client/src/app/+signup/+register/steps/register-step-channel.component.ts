import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input, output } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { SignupService } from '@app/+signup/shared/signup.service'
import { VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR, VIDEO_CHANNEL_NAME_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'

@Component({
  selector: 'my-register-step-channel',
  templateUrl: './register-step-channel.component.html',
  styleUrls: [ './step.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, BytesPipe ]
})
export class RegisterStepChannelComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private signupService = inject(SignupService)

  readonly username = input<string>(undefined)
  readonly instanceName = input<string>(undefined)
  readonly videoQuota = input<number>(undefined)

  readonly formBuilt = output<FormGroup>()

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      displayName: VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      name: VIDEO_CHANNEL_NAME_VALIDATOR
    })

    setTimeout(() => this.formBuilt.emit(this.form))

    concat(
      of(''),
      this.form.get('displayName').valueChanges
    ).pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => this.onDisplayNameChange(oldValue, newValue))
  }

  isSameThanUsername () {
    const username = this.username()
    return username && username === this.form.value['name']
  }

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const name = this.form.value['name'] || ''

    const newName = this.signupService.getNewUsername(oldDisplayName, newDisplayName, name)
    this.form.patchValue({ name: newName })
  }
}
