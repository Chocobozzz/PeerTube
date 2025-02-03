import { NgClass, NgIf } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { AuthService, HooksService, Notifier, RedirectService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { shallowCopy } from '@peertube/peertube-core-utils'
import { VideoChannelUpdate } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { ActorAvatarEditComponent } from '../shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '../shared-actor-image-edit/actor-banner-edit.component'
import { MarkdownTextareaComponent } from '../shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { VideoChannelEdit } from './video-channel-edit'

@Component({
  selector: 'my-video-channel-update',
  templateUrl: './video-channel-edit.component.html',
  styleUrls: [ './video-channel-edit.component.scss' ],
  imports: [
    NgIf,
    FormsModule,
    ReactiveFormsModule,
    ActorBannerEditComponent,
    ActorAvatarEditComponent,
    NgClass,
    HelpComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    AlertComponent
  ]
})
export class VideoChannelUpdateComponent extends VideoChannelEdit implements OnInit, AfterViewInit, OnDestroy {
  error: string

  private paramsSub: Subscription
  private oldSupportField: string

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private notifier: Notifier,
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService,
    private redirectService: RedirectService,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'display-name': VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      'description': VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      'support': VIDEO_CHANNEL_SUPPORT_VALIDATOR,
      'bulkVideosSupportUpdate': null
    })

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoChannelName = routeParams['videoChannelName']

      this.videoChannelService.getVideoChannel(videoChannelName)
        .subscribe({
          next: videoChannelToUpdate => {
            this.videoChannel = videoChannelToUpdate

            this.hooks.runAction('action:video-channel-update.video-channel.loaded', 'video-channel', { videoChannel: this.videoChannel })

            this.oldSupportField = videoChannelToUpdate.support

            this.form.patchValue({
              'display-name': videoChannelToUpdate.displayName,
              'description': videoChannelToUpdate.description,
              'support': videoChannelToUpdate.support
            })
          },

          error: err => {
            this.error = err.message
          }
        })
    })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-update.init', 'video-channel')
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

    this.videoChannelService.updateVideoChannel(this.videoChannel.name, videoChannelUpdate)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Video channel ${videoChannelUpdate.displayName} updated.`)

          this.redirectService.redirectToPreviousRoute('/c/' + this.videoChannel.name)
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  onAvatarChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelImage(this.videoChannel.name, formData, 'avatar')
        .subscribe({
          next: data => {
            this.notifier.success($localize`Avatar changed.`)

            this.videoChannel.updateAvatar(data.avatars)

            // So my-actor-avatar component detects changes
            this.videoChannel = shallowCopy(this.videoChannel)
          },

          error: (err: HttpErrorResponse) => genericUploadErrorHandler({
            err,
            name: $localize`avatar`,
            notifier: this.notifier
          })
        })
  }

  onAvatarDelete () {
    this.videoChannelService.deleteVideoChannelImage(this.videoChannel.name, 'avatar')
                            .subscribe({
                              next: () => {
                                this.notifier.success($localize`Avatar deleted.`)

                                this.videoChannel.resetAvatar()

                                // So my-actor-avatar component detects changes
                                this.videoChannel = shallowCopy(this.videoChannel)
                              },

                              error: err => this.notifier.error(err.message)
                            })
  }

  onBannerChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelImage(this.videoChannel.name, formData, 'banner')
        .subscribe({
          next: data => {
            this.notifier.success($localize`Banner changed.`)

            this.videoChannel.updateBanner(data.banners)
          },

          error: (err: HttpErrorResponse) => genericUploadErrorHandler({
            err,
            name: $localize`banner`,
            notifier: this.notifier
          })
        })
  }

  onBannerDelete () {
    this.videoChannelService.deleteVideoChannelImage(this.videoChannel.name, 'banner')
                            .subscribe({
                              next: () => {
                                this.notifier.success($localize`Banner deleted.`)

                                this.videoChannel.resetBanner()
                              },

                              error: err => this.notifier.error(err.message)
                            })
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return $localize`Update ${this.videoChannel?.name}`
  }

  isBulkUpdateVideosDisplayed () {
    if (this.oldSupportField === undefined) return false

    return this.oldSupportField !== this.form.value['support']
  }
}
