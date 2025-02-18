import { NgClass, NgIf } from '@angular/common'
import { AfterViewInit, Component, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, HooksService, Notifier } from '@app/core'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { HttpStatusCode, VideoChannelCreate } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { ActorAvatarEditComponent } from '../shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '../shared-actor-image-edit/actor-banner-edit.component'
import { MarkdownTextareaComponent } from '../shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { VideoChannelEdit } from './video-channel-edit'

@Component({
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
export class VideoChannelCreateComponent extends VideoChannelEdit implements OnInit, AfterViewInit {
  error: string
  videoChannel = new VideoChannel({})

  private avatar: FormData
  private banner: FormData

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private videoChannelService: VideoChannelService,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'name': VIDEO_CHANNEL_NAME_VALIDATOR,
      'display-name': VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      'description': VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      'support': VIDEO_CHANNEL_SUPPORT_VALIDATOR
    })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-create.init', 'video-channel')
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

    this.videoChannelService.createVideoChannel(videoChannelCreate)
      .pipe(
        switchMap(() => this.uploadAvatar()),
        switchMap(() => this.uploadBanner())
      ).subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Video channel ${videoChannelCreate.displayName} created.`)
          this.router.navigate([ '/my-library', 'video-channels' ])
        },

        error: err => {
          if (err.status === HttpStatusCode.CONFLICT_409) {
            this.error = $localize`This name already exists on this platform.`
            return
          }

          this.error = err.message
        }
      })
  }

  onAvatarChange (formData: FormData) {
    this.avatar = formData
  }

  onAvatarDelete () {
    this.avatar = null
  }

  onBannerChange (formData: FormData) {
    this.banner = formData
  }

  onBannerDelete () {
    this.banner = null
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return $localize`Create your channel`
  }

  getUsername () {
    return this.form.value.name
  }

  private uploadAvatar () {
    if (!this.avatar) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(this.getUsername(), this.avatar, 'avatar')
  }

  private uploadBanner () {
    if (!this.banner) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(this.getUsername(), this.banner, 'banner')
  }
}
