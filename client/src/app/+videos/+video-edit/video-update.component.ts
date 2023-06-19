import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Component, HostListener, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier } from '@app/core'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { Video, VideoCaptionEdit, VideoCaptionService, VideoDetails, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { logger } from '@root-helpers/logger'
import { pick, simpleObjectsDeepEqual } from '@shared/core-utils'
import { LiveVideo, LiveVideoUpdate, VideoPrivacy, VideoState } from '@shared/models'
import { VideoSource } from '@shared/models/videos/video-source'
import { hydrateFormFromVideo } from './shared/video-edit-utils'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  videoEdit: VideoEdit
  videoDetails: VideoDetails
  videoSource: VideoSource
  userVideoChannels: SelectChannelItem[] = []
  videoCaptions: VideoCaptionEdit[] = []
  liveVideo: LiveVideo

  isUpdatingVideo = false
  forbidScheduledPublication = false

  private updateDone = false

  constructor (
    protected formReactiveService: FormReactiveService,
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
    const { video, videoChannels, videoCaptions, videoSource, liveVideo, videoPassword } = videoData

    this.videoDetails = video
    this.videoEdit = new VideoEdit(this.videoDetails, videoPassword)

    this.userVideoChannels = videoChannels
    this.videoCaptions = videoCaptions
    this.videoSource = videoSource
    this.liveVideo = liveVideo

    this.forbidScheduledPublication = this.videoEdit.privacy !== VideoPrivacy.PRIVATE
  }

  onFormBuilt () {
    hydrateFormFromVideo(this.form, this.videoEdit, true)

    if (this.liveVideo) {
      this.form.patchValue({
        saveReplay: this.liveVideo.saveReplay,
        replayPrivacy: this.liveVideo.replaySettings ? this.liveVideo.replaySettings.privacy : VideoPrivacy.PRIVATE,
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

  isWaitTranscodingHidden () {
    return this.videoDetails.state.id !== VideoState.TO_TRANSCODE
  }

  async update () {
    await this.waitPendingCheck()
    this.forceCheck()

    if (!this.form.valid || this.isUpdatingVideo === true) {
      return
    }

    this.videoEdit.patch(this.form.value)

    this.loadingBar.useRef().start()
    this.isUpdatingVideo = true

    // Update the video
    this.videoService.updateVideo(this.videoEdit)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(this.videoEdit.id, this.videoCaptions)),

          switchMap(() => {
            if (!this.liveVideo) return of(undefined)

            const saveReplay = !!this.form.value.saveReplay
            const replaySettings = saveReplay
              ? { privacy: this.form.value.replayPrivacy }
              : undefined

            const liveVideoUpdate: LiveVideoUpdate = {
              saveReplay,
              replaySettings,
              permanentLive: !!this.form.value.permanentLive,
              latencyMode: this.form.value.latencyMode
            }

            // Don't update live attributes if they did not change
            const baseVideo = pick(this.liveVideo, Object.keys(liveVideoUpdate) as (keyof LiveVideoUpdate)[])
            const liveChanged = !simpleObjectsDeepEqual(baseVideo, liveVideoUpdate)
            if (!liveChanged) return of(undefined)

            return this.liveVideoService.updateLive(this.videoEdit.id, liveVideoUpdate)
          })
        )
        .subscribe({
          next: () => {
            this.updateDone = true
            this.isUpdatingVideo = false
            this.loadingBar.useRef().complete()
            this.notifier.success($localize`Video updated.`)
            this.router.navigateByUrl(Video.buildWatchUrl(this.videoEdit))
          },

          error: err => {
            this.loadingBar.useRef().complete()
            this.isUpdatingVideo = false
            this.notifier.error(err.message)
            logger.error(err)
          }
        })
  }

  hydratePluginFieldsFromVideo () {
    if (!this.videoEdit.pluginData) return

    this.form.patchValue({
      pluginData: this.videoEdit.pluginData
    })
  }

  getVideoUrl () {
    return Video.buildWatchUrl(this.videoDetails)
  }
}
