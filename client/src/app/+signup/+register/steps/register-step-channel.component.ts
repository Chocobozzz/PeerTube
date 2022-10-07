import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR, VIDEO_CHANNEL_NAME_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { UserSignupService } from '@app/shared/shared-users'

@Component({
  selector: 'my-register-step-channel',
  templateUrl: './register-step-channel.component.html',
  styleUrls: [ './step.component.scss' ]
})
export class RegisterStepChannelComponent extends FormReactive implements OnInit {
  @Input() username: string
  @Input() instanceName: string
  @Input() videoQuota: number

  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formReactiveService: FormReactiveService,
    private userSignupService: UserSignupService
  ) {
    super()
  }

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
    return this.username && this.username === this.form.value['name']
  }

  private onDisplayNameChange (oldDisplayName: string, newDisplayName: string) {
    const name = this.form.value['name'] || ''

    const newName = this.userSignupService.getNewUsername(oldDisplayName, newDisplayName, name)
    this.form.patchValue({ name: newName })
  }
}
