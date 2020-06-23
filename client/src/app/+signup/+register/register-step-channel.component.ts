import { concat, of } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { UserService } from '@app/core'
import { FormReactive, FormValidatorService, VideoChannelValidatorsService } from '@app/shared/shared-forms'

@Component({
  selector: 'my-register-step-channel',
  templateUrl: './register-step-channel.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterStepChannelComponent extends FormReactive implements OnInit {
  @Input() username: string
  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private userService: UserService,
    private videoChannelValidatorsService: VideoChannelValidatorsService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      displayName: this.videoChannelValidatorsService.VIDEO_CHANNEL_DISPLAY_NAME,
      name: this.videoChannelValidatorsService.VIDEO_CHANNEL_NAME
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

    const newName = this.userService.getNewUsername(oldDisplayName, newDisplayName, name)
    this.form.patchValue({ name: newName })
  }
}
