import { map, switchMap } from 'rxjs/operators'
import { Component, HostListener, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoDetails, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoPrivacy } from '@shared/models'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit

  isUpdatingVideo = false
  userVideoChannels: { id: number, label: string, support: string }[] = []
  schedulePublicationPossible = false
  videoCaptions: VideoCaptionEdit[] = []
  waitTranscodingEnabled = true

  private updateDone = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private router: Router,
    private notifier: Notifier,
    private videoService: VideoService,
    private loadingBar: LoadingBarService,
    private videoCaptionService: VideoCaptionService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({})

    this.route.data
        .pipe(map(data => data.videoData))
        .subscribe(({ video, videoChannels, videoCaptions }) => {
          this.video = new VideoEdit(video)
          this.userVideoChannels = videoChannels
          this.videoCaptions = videoCaptions

          this.schedulePublicationPossible = this.video.privacy === VideoPrivacy.PRIVATE

          const videoFiles = (video as VideoDetails).getFiles()
          if (videoFiles.length > 1) { // Already transcoded
            this.waitTranscodingEnabled = false
          }

          // FIXME: Angular does not detect the change inside this subscription, so use the patched setTimeout
          setTimeout(() => this.hydrateFormFromVideo())
        },

        err => {
          console.error(err)
          this.notifier.error(err.message)
        }
      )
  }

  @HostListener('window:beforeunload', [ '$event' ])
  onUnload (event: any) {
    const { text, canDeactivate } = this.canDeactivate()

    if (canDeactivate) return

    event.returnValue = text
    return text
  }

  canDeactivate (): { canDeactivate: boolean, text?: string } {
    if (this.updateDone === true) return { canDeactivate: true }

    const text = this.i18n('You have unsaved changes! If you leave, your changes will be lost.')

    for (const caption of this.videoCaptions) {
      if (caption.action) return { canDeactivate: false, text }
    }

    return { canDeactivate: this.formChanged === false, text }
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  update () {
    if (this.checkForm() === false
      || this.isUpdatingVideo === true) {
      return
    }

    this.video.patch(this.form.value)

    this.loadingBar.useRef().start()
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
            this.loadingBar.useRef().complete()
            this.notifier.success(this.i18n('Video updated.'))
            this.router.navigate([ '/videos/watch', this.video.uuid ])
          },

          err => {
            this.loadingBar.useRef().complete()
            this.isUpdatingVideo = false
            this.notifier.error(err.message)
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
