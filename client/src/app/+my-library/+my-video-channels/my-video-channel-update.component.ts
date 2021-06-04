import { Subscription } from 'rxjs'
import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { HTMLServerConfig, VideoChannelUpdate } from '@shared/models'
import { MyVideoChannelEdit } from './my-video-channel-edit'

@Component({
  selector: 'my-video-channel-update',
  templateUrl: './my-video-channel-edit.component.html',
  styleUrls: [ './my-video-channel-edit.component.scss' ]
})
export class MyVideoChannelUpdateComponent extends MyVideoChannelEdit implements OnInit, OnDestroy {
  error: string
  videoChannel: VideoChannel

  private paramsSub: Subscription
  private oldSupportField: string
  private serverConfig: HTMLServerConfig

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
    this.serverConfig = this.serverService.getHTMLConfig()

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
          this.videoChannel = videoChannelToUpdate

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

    this.videoChannelService.updateVideoChannel(this.videoChannel.name, videoChannelUpdate).subscribe(
      () => {
        this.authService.refreshUserInformation()

        this.notifier.success($localize`Video channel ${videoChannelUpdate.displayName} updated.`)

        this.router.navigate([ '/my-library', 'video-channels' ])
      },

      err => this.error = err.message
    )
  }

  onAvatarChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelImage(this.videoChannel.name, formData, 'avatar')
        .subscribe(
          data => {
            this.notifier.success($localize`Avatar changed.`)

            this.videoChannel.updateAvatar(data.avatar)
          },

          (err: HttpErrorResponse) => genericUploadErrorHandler({
            err,
            name: $localize`avatar`,
            notifier: this.notifier
          })
        )
  }

  onAvatarDelete () {
    this.videoChannelService.deleteVideoChannelImage(this.videoChannel.name, 'avatar')
                            .subscribe(
                              data => {
                                this.notifier.success($localize`Avatar deleted.`)

                                this.videoChannel.resetAvatar()
                              },

                              err => this.notifier.error(err.message)
                            )
  }

  onBannerChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelImage(this.videoChannel.name, formData, 'banner')
        .subscribe(
          data => {
            this.notifier.success($localize`Banner changed.`)

            this.videoChannel.updateBanner(data.banner)
          },

          (err: HttpErrorResponse) => genericUploadErrorHandler({
            err,
            name: $localize`banner`,
            notifier: this.notifier
          })
        )
  }

  onBannerDelete () {
    this.videoChannelService.deleteVideoChannelImage(this.videoChannel.name, 'banner')
                            .subscribe(
                              data => {
                                this.notifier.success($localize`Banner deleted.`)

                                this.videoChannel.resetBanner()
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
