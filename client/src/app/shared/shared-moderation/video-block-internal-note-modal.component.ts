import { NgClass } from '@angular/common'
import { Component, OnInit, inject, output, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { VideoBlacklist } from '@peertube/peertube-models'
import { VIDEO_BLOCK_INTERNAL_NOTE_VALIDATOR } from '../form-validators/video-block-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { VideoBlockService } from './video-block.service'

@Component({
  selector: 'my-video-block-internal-note-modal',
  templateUrl: './video-block-internal-note-modal.component.html',
  styleUrls: [ './video-block-internal-note-modal.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass ]
})
export class VideoBlockInternalNoteModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private videoBlocklistService = inject(VideoBlockService)

  readonly modal = viewChild<NgbModal>('modal')
  readonly internalNoteUpdated = output()

  private entries: VideoBlacklist[]
  private openedModal: NgbModalRef

  ngOnInit () {
    this.buildForm({
      internalNote: VIDEO_BLOCK_INTERNAL_NOTE_VALIDATOR
    })
  }

  openModal (entries: VideoBlacklist[]) {
    this.entries = entries

    const currentNote = entries.length === 1
      ? entries[0].internalNote
      : ''

    this.form.controls['internalNote'].setValue(currentNote)

    this.openedModal = this.modalService.open(this.modal(), { centered: true })
  }

  hide () {
    this.entries = undefined
    this.openedModal.close()
  }

  getModalTitle () {
    if (this.entries?.length === 1) {
      return $localize`Set internal note`
    }

    return formatICU(
      $localize`Set internal note for {count} videos`,
      { count: this.entries?.length ?? 0 }
    )
  }

  save () {
    const note = this.form.value['internalNote'] || null

    this.videoBlocklistService.updateBlocks(
      this.entries.map(entry => ({ videoId: entry.video.id, internalNote: note }))
    ).subscribe({
      next: () => {
        for (const entry of this.entries) {
          entry.internalNote = note
        }

        this.notifier.success(
          formatICU(
            $localize`{count, plural, =1 {Internal note updated} other {{count} internal notes updated}}`,
            { count: this.entries.length }
          )
        )
        this.internalNoteUpdated.emit()
        this.hide()
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
