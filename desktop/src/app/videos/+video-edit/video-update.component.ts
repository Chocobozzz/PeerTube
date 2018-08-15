import { map, switchMap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoConstant, VideoPrivacy } from '../../../../../shared/models/videos'
import { ServerService } from '../../core'
import { AuthService } from '../../core/auth'
import { FormReactive } from '../../shared'
import { VideoEdit } from '../../shared/video/video-edit.model'
import { VideoService } from '../../shared/video/video.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit

  isUpdatingVideo = false
  videoPrivacies: VideoConstant<string>[] = []
  userVideoChannels: { id: number, label: string, support: string }[] = []
  schedulePublicationPossible = false
  videoCaptions: VideoCaptionEdit[] = []

  private updateDone = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private videoService: VideoService,
    private authService: AuthService,
    private loadingBar: LoadingBarService,
    private videoChannelService: VideoChannelService,
    private videoCaptionService: VideoCaptionService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({})

    this.serverService.videoPrivaciesLoaded
        .subscribe(() => this.videoPrivacies = this.serverService.getVideoPrivacies())

    this.route.data
        .pipe(map(data => data.videoData))
        .subscribe(({ video, videoChannels, videoCaptions }) => {
          this.video = new VideoEdit(video)
          this.userVideoChannels = videoChannels
          this.videoCaptions = videoCaptions

          // We cannot set private a video that was not private
          if (this.video.privacy !== VideoPrivacy.PRIVATE) {
            this.videoPrivacies = this.videoPrivacies.filter(p => p.id.toString() !== VideoPrivacy.PRIVATE.toString())
          } else { // We can schedule video publication only if it it is private
            this.schedulePublicationPossible = this.video.privacy === VideoPrivacy.PRIVATE
          }

          // FIXME: Angular does not detect the change inside this subscription, so use the patched setTimeout
          setTimeout(() => this.hydrateFormFromVideo())
        },

        err => {
          console.error(err)
          this.notificationsService.error(this.i18n('Error'), err.message)
        }
      )
  }

  canDeactivate () {
    if (this.updateDone === true) return { canDeactivate: true }

    for (const caption of this.videoCaptions) {
      if (caption.action) return { canDeactivate: false }
    }

    return { canDeactivate: this.formChanged === false }
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  update () {
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
            this.updateDone = true
            this.isUpdatingVideo = false
            this.loadingBar.complete()
            this.notificationsService.success(this.i18n('Success'), this.i18n('Video updated.'))
            this.router.navigate([ '/videos/watch', this.video.uuid ])
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

    const objects = [
      {
        url: 'thumbnailUrl',
        name: 'thumbnailfile'
      },
      {
        url: 'previewUrl',
        name: 'previewfile'
      }
    ]

    for (const obj of objects) {
      fetch(this.video[obj.url])
        .then(response => response.blob())
        .then(data => {
          this.form.patchValue({
            [ obj.name ]: data
          })
        })
    }
  }
}
