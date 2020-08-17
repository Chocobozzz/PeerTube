import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannelService } from '@app/shared/shared-main'
import { VideoChannelCreate } from '@shared/models'
import { MyAccountVideoChannelEdit } from './my-account-video-channel-edit'

@Component({
  selector: 'my-account-video-channel-create',
  templateUrl: './my-account-video-channel-edit.component.html',
  styleUrls: [ './my-account-video-channel-edit.component.scss' ]
})
export class MyAccountVideoChannelCreateComponent extends MyAccountVideoChannelEdit implements OnInit {
  error: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private videoChannelService: VideoChannelService
    ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      name: VIDEO_CHANNEL_NAME_VALIDATOR,
      'display-name': VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      description: VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      support: VIDEO_CHANNEL_SUPPORT_VALIDATOR
    })
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelCreate: VideoChannelCreate = {
      name: body.name,
      displayName: body['display-name'],
      description: body.description || null,
      support: body.support || null
    }

    this.videoChannelService.createVideoChannel(videoChannelCreate).subscribe(
      () => {
        this.authService.refreshUserInformation()

        this.notifier.success($localize`Video channel ${videoChannelCreate.displayName} created.`)
        this.router.navigate([ '/my-account', 'video-channels' ])
      },

      err => {
        if (err.status === 409) {
          this.error = $localize`This name already exists on this instance.`
          return
        }

        this.error = err.message
      }
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return $localize`Create`
  }
}
