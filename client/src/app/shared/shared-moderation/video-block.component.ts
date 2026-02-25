import { NgClass } from '@angular/common'
import { Component, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { VIDEO_BLOCK_REASON_VALIDATOR } from '../form-validators/video-block-validators'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { VideoBlockService } from './video-block.service'

@Component({
  selector: 'my-video-block',
  templateUrl: './video-block.component.html',
  styleUrls: [ './video-block.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, PeertubeCheckboxComponent ]
})
export class VideoBlockComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private videoBlocklistService = inject(VideoBlockService)
  private notifier = inject(Notifier)

  readonly modal = viewChild<NgbModal>('modal')

  readonly videoBlocked = output()

  videos: Video[]

  error: string = null

  private openedModal: NgbModalRef

  ngOnInit () {
    const defaultValues = { unfederate: 'true' }

    this.buildForm({
      reason: VIDEO_BLOCK_REASON_VALIDATOR,
      unfederate: null
    }, defaultValues)
  }

  isMultiple () {
    return this.videos.length > 1
  }

  getSingleVideo () {
    return this.videos[0]
  }

  hasLive () {
    return this.videos.some(v => v.isLive)
  }

  hasLocal () {
    return this.videos.some(v => v.isLocal)
  }

  show (videos: Video[]) {
    this.videos = videos

    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  block () {
    const options = this.videos.map(v => ({
      videoId: v.id,
      reason: this.form.value['reason'] || undefined,
      unfederate: v.isLocal
        ? this.form.value['unfederate']
        : undefined
    }))

    this.videoBlocklistService.blockVideo(options)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`{count, plural, =1 {Blocked {videoName}.} other {Blocked {count} videos.}}`,
            { count: this.videos.length, videoName: this.getSingleVideo().name }
          )

          this.notifier.success(message)
          this.hide()

          for (const o of options) {
            const video = this.videos.find(v => v.id === o.videoId)

            video.blacklisted = true
            video.blacklistedReason = o.reason
          }

          this.videoBlocked.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
