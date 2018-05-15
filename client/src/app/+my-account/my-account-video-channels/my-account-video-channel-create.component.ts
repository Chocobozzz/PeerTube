import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { MyAccountVideoChannelEdit } from './my-account-video-channel-edit'
import { FormBuilder, FormGroup } from '@angular/forms'
import { VideoChannelCreate } from '../../../../../shared/models/videos'
import {
  VIDEO_CHANNEL_DESCRIPTION,
  VIDEO_CHANNEL_DISPLAY_NAME,
  VIDEO_CHANNEL_SUPPORT
} from '@app/shared/forms/form-validators/video-channel'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { AuthService } from '@app/core'

@Component({
  selector: 'my-account-video-channel-create',
  templateUrl: './my-account-video-channel-edit.component.html',
  styleUrls: [ './my-account-video-channel-edit.component.scss' ]
})
export class MyAccountVideoChannelCreateComponent extends MyAccountVideoChannelEdit implements OnInit {
  error: string

  form: FormGroup
  formErrors = {
    'display-name': '',
    'description': '',
    'support': ''
  }
  validationMessages = {
    'display-name': VIDEO_CHANNEL_DISPLAY_NAME.MESSAGES,
    'description': VIDEO_CHANNEL_DESCRIPTION.MESSAGES,
    'support': VIDEO_CHANNEL_SUPPORT.MESSAGES
  }

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private router: Router,
    private formBuilder: FormBuilder,
    private videoChannelService: VideoChannelService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      'display-name': [ '', VIDEO_CHANNEL_DISPLAY_NAME.VALIDATORS ],
      description: [ '', VIDEO_CHANNEL_DESCRIPTION.VALIDATORS ],
      support: [ '', VIDEO_CHANNEL_SUPPORT.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelCreate: VideoChannelCreate = {
      displayName: body['display-name'],
      description: body.description || null,
      support: body.support || null
    }

    this.videoChannelService.createVideoChannel(videoChannelCreate).subscribe(
      () => {
        this.authService.refreshUserInformation()
        this.notificationsService.success('Success', `Video channel ${videoChannelCreate.displayName} created.`)
        this.router.navigate([ '/my-account', 'video-channels' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return 'Create'
  }
}
