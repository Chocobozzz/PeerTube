import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Component, HostListener, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { Video, VideoCaptionEdit, VideoCaptionService, VideoDetails, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { LiveVideo, LiveVideoUpdate, VideoPrivacy } from '@shared/models'
import { hydrateFormFromVideo } from './shared/video-edit-utils'
import { VideoSource } from '@shared/models/videos/video-source'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit
  videoDetails: VideoDetails
  videoSource: VideoSource
  userVideoChannels: SelectChannelItem[] = []
  videoCaptions: VideoCaptionEdit[] = []
  liveVideo: LiveVideo

  isUpdatingVideo = false
  forbidScheduledPublication = false
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

    const { videoData } = this.route.snapshot.data
    const { video, videoChannels, videoCaptions, videoSource, liveVideo } = videoData

    this.video = new VideoEdit(video)
    this.videoDetails = video

    this.userVideoChannels = videoChannels
    this.videoCaptions = videoCaptions
    this.videoSource = videoSource
    this.liveVideo = liveVideo

    this.forbidScheduledPublication = this.video.privacy !== VideoPrivacy.PRIVATE
  }

  onFormBuilt () {
    hydrateFormFromVideo(this.form, this.video, true)

    if (this.liveVideo) {
      this.form.patchValue({
        saveReplay: this.liveVideo.saveReplay,
        latencyMode: this.liveVideo.latencyMode,
        permanentLive: this.liveVideo.permanentLive
      })
    }
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

  isWaitTranscodingEnabled () {
    if (this.videoDetails.getFiles().length > 1) { // Already transcoded
      return false
    }

    if (this.liveVideo && this.form.value['saveReplay'] !== true) {
      return false
    }

    return true
  }

  async update () {
    await this.waitPendingCheck()
    this.forceCheck()

    if (!this.form.valid || this.isUpdatingVideo === true) {
      return
    }

    this.video.patch(this.form.value)

    this.loadingBar.useRef().start()
    this.isUpdatingVideo = true

    // Update the video
    this.videoService.updateVideo(this.video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(this.video.id, this.videoCaptions)),

          switchMap(() => {
            if (!this.liveVideo) return of(undefined)

            const liveVideoUpdate: LiveVideoUpdate = {
              saveReplay: !!this.form.value.saveReplay,
              permanentLive: !!this.form.value.permanentLive,
              latencyMode: this.form.value.latencyMode
            }

            // Don't update live attributes if they did not change
            const liveChanged = Object.keys(liveVideoUpdate)
              .some(key => this.liveVideo[key] !== liveVideoUpdate[key])
            if (!liveChanged) return of(undefined)

            return this.liveVideoService.updateLive(this.video.id, liveVideoUpdate)
          })
        )
        .subscribe({
          next: () => {
            this.updateDone = true
            this.isUpdatingVideo = false
            this.loadingBar.useRef().complete()
            this.notifier.success($localize`Video updated.`)
            this.router.navigateByUrl(Video.buildWatchUrl(this.video))
          },

          error: err => {
            this.loadingBar.useRef().complete()
            this.isUpdatingVideo = false
            this.notifier.error(err.message)
            console.error(err)
          }
        })
  }

  hydratePluginFieldsFromVideo () {
    if (!this.video.pluginData) return

    this.form.patchValue({
      pluginData: this.video.pluginData
    })
  }

  getVideoUrl () {
    return Video.buildWatchUrl(this.videoDetails)
  }
}
