import { FormReactive } from '@app/shared'
import { OnInit } from '@angular/core'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { populateAsyncUserVideoChannels } from '@app/shared/misc/utils'
import { VideoConstant, VideoPrivacy } from '../../../../../../shared/models/videos'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { NotificationsService } from 'angular2-notifications'
import { AuthService, ServerService } from '@app/core'
import { VideoService } from '@app/shared/video/video.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { catchError, switchMap, tap } from 'rxjs/operators'
import { VideoEdit } from '@app/shared/video/video-edit.model'

export abstract class VideoSend extends FormReactive implements OnInit, CanComponentDeactivate {

  userVideoChannels: { id: number, label: string, support: string }[] = []
  videoPrivacies: VideoConstant<string>[] = []
  videoCaptions: VideoCaptionEdit[] = []

  firstStepPrivacyId = 0
  firstStepChannelId = 0

  protected abstract readonly DEFAULT_VIDEO_PRIVACY: VideoPrivacy

  protected loadingBar: LoadingBarService
  protected notificationsService: NotificationsService
  protected authService: AuthService
  protected serverService: ServerService
  protected videoService: VideoService
  protected videoCaptionService: VideoCaptionService

  abstract canDeactivate ()

  ngOnInit () {
    this.buildForm({})

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .then(() => this.firstStepChannelId = this.userVideoChannels[ 0 ].id)

    this.serverService.videoPrivaciesLoaded
        .subscribe(
          () => {
            this.videoPrivacies = this.serverService.getVideoPrivacies()

            this.firstStepPrivacyId = this.DEFAULT_VIDEO_PRIVACY
          })
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  protected updateVideoAndCaptions (video: VideoEdit) {
    this.loadingBar.start()

    return this.videoService.updateVideo(video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(video.id, this.videoCaptions)),
          tap(() => this.loadingBar.complete()),
          catchError(err => {
            this.loadingBar.complete()
            throw err
          })
        )
  }
}
