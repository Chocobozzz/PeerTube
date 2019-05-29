import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { AuthService } from '@app/core'
import { FormReactive, VideoChannelValidatorsService } from '../shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-signup-step-channel',
  templateUrl: './signup-step-channel.component.html',
  styleUrls: [ './signup.component.scss' ]
})
export class SignupStepChannelComponent extends FormReactive implements OnInit {
  @Input() username: string
  @Output() formBuilt = new EventEmitter<FormGroup>()

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private videoChannelValidatorsService: VideoChannelValidatorsService
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  isSameThanUsername () {
    return this.username && this.username === this.form.value['name']
  }

  ngOnInit () {
    this.buildForm({
      name: this.videoChannelValidatorsService.VIDEO_CHANNEL_NAME,
      displayName: this.videoChannelValidatorsService.VIDEO_CHANNEL_DISPLAY_NAME
    })

    setTimeout(() => this.formBuilt.emit(this.form))
  }
}
