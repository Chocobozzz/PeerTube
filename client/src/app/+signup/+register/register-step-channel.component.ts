import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { AuthService } from '@app/core'
import { FormReactive, VideoChannelValidatorsService } from '@app/shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { FormGroup } from '@angular/forms'

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
