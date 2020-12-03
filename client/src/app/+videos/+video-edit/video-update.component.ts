import { of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Component, HostListener, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService, SelectChannelItem } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoDetails, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { LiveVideo, LiveVideoUpdate, VideoPrivacy } from '@shared/models'
import { hydrateFormFromVideo } from './shared/video-edit-utils'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit
  userVideoChannels: SelectChannelItem[] = []
  videoCaptions: VideoCaptionEdit[] = []
  liveVideo: LiveVideo

  isUpdatingVideo = false
  schedulePublicationPossible = false
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
    private liveVideoService: LiveVideoService
    ) {
    super()
  }

  ngOnInit () {
    this.buildForm({})

    this.route.data
        .pipe(map(data => data.videoData))
        .subscribe(({ video, videoChannels, videoCaptions, liveVideo }) => {
          this.video = new VideoEdit(video)
          this.userVideoChannels = videoChannels
          this.videoCaptions = videoCaptions
          this.liveVideo = liveVideo

          this.schedulePublicationPossible = this.video.privacy === VideoPrivacy.PRIVATE

          const videoFiles = (video as VideoDetails).getFiles()
          if (videoFiles.length > 1) { // Already transcoded
            this.waitTranscodingEnabled = false
          }

          // FIXME: Angular does not detect the change inside this subscription, so use the patched setTimeout
          setTimeout(() => {
            hydrateFormFromVideo(this.form, this.video, true)

            if (this.liveVideo) {
              this.form.patchValue({
                saveReplay: this.liveVideo.saveReplay,
                permanentLive: this.liveVideo.permanentLive
              })
            }
          })
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

    const text = $localize`You have unsaved changes! If you leave, your changes will be lost.`

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

    const liveVideoUpdate: LiveVideoUpdate = {
      saveReplay: this.form.value.saveReplay,
      permanentLive: this.form.value.permanentLive
    }

    this.loadingBar.useRef().start()
    this.isUpdatingVideo = true

    // Update the video
    this.videoService.updateVideo(this.video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(this.video.id, this.videoCaptions)),

          switchMap(() => {
            if (!this.liveVideo) return of(undefined)

            return this.liveVideoService.updateLive(this.video.id, liveVideoUpdate)
          })
        )
        .subscribe(
          () => {
            this.updateDone = true
            this.isUpdatingVideo = false
            this.loadingBar.useRef().complete()
            this.notifier.success($localize`Video updated.`)
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

  hydratePluginFieldsFromVideo () {
    if (!this.video.pluginData) return

    this.form.patchValue({
      pluginData: this.video.pluginData
    })
  }
}
