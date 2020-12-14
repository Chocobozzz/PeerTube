import { Subscription } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { ServerConfig, VideoChannelUpdate } from '@shared/models'
import { MyVideoChannelEdit } from './my-video-channel-edit'
import { HttpErrorResponse } from '@angular/common/http'
import { uploadErrorHandler } from '@app/helpers'

@Component({
  selector: 'my-video-channel-update',
  templateUrl: './my-video-channel-edit.component.html',
  styleUrls: [ './my-video-channel-edit.component.scss' ]
})
export class MyVideoChannelUpdateComponent extends MyVideoChannelEdit implements OnInit, OnDestroy {
  error: string
  videoChannelToUpdate: VideoChannel

  private paramsSub: Subscription
  private oldSupportField: string
  private serverConfig: ServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.buildForm({
      'display-name': VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      description: VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      support: VIDEO_CHANNEL_SUPPORT_VALIDATOR,
      bulkVideosSupportUpdate: null
    })

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoChannelId = routeParams['videoChannelId']

      this.videoChannelService.getVideoChannel(videoChannelId).subscribe(
        videoChannelToUpdate => {
          this.videoChannelToUpdate = videoChannelToUpdate

          this.oldSupportField = videoChannelToUpdate.support

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
      support: body.support || null,
      bulkVideosSupportUpdate: body.bulkVideosSupportUpdate || false
    }

    this.videoChannelService.updateVideoChannel(this.videoChannelToUpdate.name, videoChannelUpdate).subscribe(
      () => {
        this.authService.refreshUserInformation()

        this.notifier.success($localize`Video channel ${videoChannelUpdate.displayName} updated.`)

        this.router.navigate([ '/my-library', 'video-channels' ])
      },

      err => this.error = err.message
    )
  }

  onAvatarChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelAvatar(this.videoChannelToUpdate.name, formData)
        .subscribe(
          data => {
            this.notifier.success($localize`Avatar changed.`)

            this.videoChannelToUpdate.updateAvatar(data.avatar)
          },

          (err: HttpErrorResponse) => uploadErrorHandler({
            err,
            name: $localize`avatar`,
            notifier: this.notifier
          })
        )
  }

  onAvatarDelete () {
    this.videoChannelService.deleteVideoChannelAvatar(this.videoChannelToUpdate.name)
                            .subscribe(
                              data => {
                                this.notifier.success($localize`Avatar deleted.`)

                                this.videoChannelToUpdate.resetAvatar()
                              },

                              err => this.notifier.error(err.message)
                            )
  }

  get maxAvatarSize () {
    return this.serverConfig.avatar.file.size.max
  }

  get avatarExtensions () {
    return this.serverConfig.avatar.file.extensions.join(',')
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return $localize`Update`
  }

  isBulkUpdateVideosDisplayed () {
    if (this.oldSupportField === undefined) return false

    return this.oldSupportField !== this.form.value['support']
  }
}
