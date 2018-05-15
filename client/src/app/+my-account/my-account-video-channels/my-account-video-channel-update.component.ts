import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { MyAccountVideoChannelEdit } from './my-account-video-channel-edit'
import { FormBuilder, FormGroup } from '@angular/forms'
import { VideoChannelUpdate } from '../../../../../shared/models/videos'
import {
  VIDEO_CHANNEL_DESCRIPTION,
  VIDEO_CHANNEL_DISPLAY_NAME,
  VIDEO_CHANNEL_SUPPORT
} from '@app/shared/forms/form-validators/video-channel'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { Subscription } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { AuthService } from '@app/core'

@Component({
  selector: 'my-account-video-channel-update',
  templateUrl: './my-account-video-channel-edit.component.html',
  styleUrls: [ './my-account-video-channel-edit.component.scss' ]
})
export class MyAccountVideoChannelUpdateComponent extends MyAccountVideoChannelEdit implements OnInit, OnDestroy {
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

  private videoChannelToUpdate: VideoChannel
  private paramsSub: Subscription

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private router: Router,
    private route: ActivatedRoute,
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

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoChannelId = routeParams['videoChannelId']

      this.videoChannelService.getVideoChannel(videoChannelId).subscribe(
        videoChannelToUpdate => {
          this.videoChannelToUpdate = videoChannelToUpdate

          this.form.patchValue({
            'display-name': videoChannelToUpdate.displayName,
            description: videoChannelToUpdate.description,
            support: videoChannelToUpdate.support
          })
        },

        err => this.error = err.message
      )
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelUpdate: VideoChannelUpdate = {
      displayName: body['display-name'],
      description: body.description || null,
      support: body.support || null
    }

    this.videoChannelService.updateVideoChannel(this.videoChannelToUpdate.uuid, videoChannelUpdate).subscribe(
      () => {
        this.authService.refreshUserInformation()
        this.notificationsService.success('Success', `Video channel ${videoChannelUpdate.displayName} updated.`)
        this.router.navigate([ '/my-account', 'video-channels' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return 'Update'
  }
}
