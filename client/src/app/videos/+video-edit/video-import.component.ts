import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { NotificationsService } from 'angular2-notifications'
import { VideoConstant, VideoPrivacy, VideoUpdate } from '../../../../../shared/models/videos'
import { AuthService, ServerService } from '../../core'
import { FormReactive } from '../../shared'
import { populateAsyncUserVideoChannels } from '../../shared/misc/utils'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'
import { VideoImportService } from '@app/shared/video-import'
import { VideoEdit } from '@app/shared/video/video-edit.model'
import { switchMap } from 'rxjs/operators'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoCaptionService } from '@app/shared/video-caption'

@Component({
  selector: 'my-video-import',
  templateUrl: './video-import.component.html',
  styleUrls: [
    './shared/video-edit.component.scss',
    './video-import.component.scss'
  ]
})
export class VideoImportComponent extends FormReactive implements OnInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()

  targetUrl = ''
  videoFileName: string

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false

  userVideoChannels: { id: number, label: string, support: string }[] = []
  videoPrivacies: VideoConstant<string>[] = []
  videoCaptions: VideoCaptionEdit[] = []

  firstStepPrivacyId = 0
  firstStepChannelId = 0
  video: VideoEdit

  constructor (
    protected formValidatorService: FormValidatorService,
    private router: Router,
    private loadingBar: LoadingBarService,
    private notificationsService: NotificationsService,
    private authService: AuthService,
    private serverService: ServerService,
    private videoService: VideoService,
    private videoImportService: VideoImportService,
    private videoCaptionService: VideoCaptionService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({})

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .then(() => this.firstStepChannelId = this.userVideoChannels[ 0 ].id)

    this.serverService.videoPrivaciesLoaded
        .subscribe(
          () => {
            this.videoPrivacies = this.serverService.getVideoPrivacies()

            // Private by default
            this.firstStepPrivacyId = VideoPrivacy.PRIVATE
          })
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  isTargetUrlValid () {
    return this.targetUrl && this.targetUrl.match(/https?:\/\//)
  }

  importVideo () {
    this.isImportingVideo = true

    const videoUpdate: VideoUpdate = {
      privacy: this.firstStepPrivacyId,
      waitTranscoding: false,
      commentsEnabled: true,
      channelId: this.firstStepChannelId
    }

    this.videoImportService.importVideo(this.targetUrl, videoUpdate).subscribe(
      res => {
        this.firstStepDone.emit(res.video.name)
        this.isImportingVideo = false
        this.hasImportedVideo = true

        this.video = new VideoEdit(Object.assign(res.video, {
          commentsEnabled: videoUpdate.commentsEnabled,
          support: null,
          thumbnailUrl: null,
          previewUrl: null
        }))
        this.hydrateFormFromVideo()
      },

      err => {
        this.isImportingVideo = false
        this.notificationsService.error(this.i18n('Error'), err.message)
      }
    )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    this.video.patch(this.form.value)

    this.loadingBar.start()
    this.isUpdatingVideo = true

    // Update the video
    this.videoService.updateVideo(this.video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(this.video.id, this.videoCaptions))
        )
        .subscribe(
          () => {
            this.isUpdatingVideo = false
            this.loadingBar.complete()
            this.notificationsService.success(this.i18n('Success'), this.i18n('Video to import updated.'))

            // TODO: route to imports list
            // this.router.navigate([ '/videos/watch', this.video.uuid ])
          },

          err => {
            this.loadingBar.complete()
            this.isUpdatingVideo = false
            this.notificationsService.error(this.i18n('Error'), err.message)
            console.error(err)
          }
        )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toFormPatch())
  }
}
