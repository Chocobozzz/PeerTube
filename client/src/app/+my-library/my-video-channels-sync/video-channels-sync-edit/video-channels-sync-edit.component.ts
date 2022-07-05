import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { Router } from 'express'

@Component({
  selector: 'my-video-channels-sync-edit',
  templateUrl: './video-channels-sync-edit.component.html',
  styleUrls: [ './video-channels-sync-edit.component.scss' ]
})
export class VideoChannelsSyncEditComponent extends FormReactive implements OnInit {
  error: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      url: VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR,
      'video-channel': null
    })
  }

  getFormButtonTitle () {
    return $localize`Create`
  }

  formValidated () {
    void 0
  }
}
