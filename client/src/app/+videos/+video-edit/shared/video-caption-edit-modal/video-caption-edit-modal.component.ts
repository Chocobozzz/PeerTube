import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'

import { VIDEO_CAPTION_FILE_CONTENT_VALIDATOR } from '@app/shared/form-validators/video-captions-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoCaptionWithPathEdit } from '@app/shared/shared-main'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, VideoConstant } from '@shared/models'
import { ServerService } from '../../../../core'

@Component({
  selector: 'my-video-caption-edit-modal',
  styleUrls: [ './video-caption-edit-modal.component.scss' ],
  templateUrl: './video-caption-edit-modal.component.html'
})

export class VideoCaptionEditModalComponent extends FormReactive implements OnInit {
  @Input() videoCaption: VideoCaptionWithPathEdit
  @Input() serverConfig: HTMLServerConfig

  @Output() captionEdited = new EventEmitter<VideoCaptionEdit>()

  @ViewChild('modal', { static: true }) modal: ElementRef

  videoCaptionLanguages: VideoConstant<string>[] = []
  private openedModal: NgbModalRef
  private closingModal = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoCaptionService: VideoCaptionService,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.serverService.getVideoLanguages().subscribe(languages => this.videoCaptionLanguages = languages)

    this.buildForm({ captionFileContent: VIDEO_CAPTION_FILE_CONTENT_VALIDATOR })

    this.loadCaptionContent()
  }

  loadCaptionContent () {
    const { captionPath } = this.videoCaption
    if (captionPath) {
      this.videoCaptionService.getCaptionContent({
        captionPath
      }).subscribe((res) => {
        this.form.patchValue({
          captionFileContent: res
        })
      })
    }
  }

  show () {
    this.closingModal = false

    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
  }

  hide () {
    this.closingModal = true
    this.openedModal.close()
  }

  cancel () {
    this.hide()
  }

  isReplacingExistingCaption () {
    return true
  }

  updateCaption () {
    const format = 'vtt'
    const languageId = this.videoCaption.language.id
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)
    this.captionEdited.emit({
      language: languageObject,
      captionfile: new File([ this.form.value['captionFileContent'] ], `${languageId}.${format}`, {
        type: 'text/vtt',
        lastModified: Date.now()
      }),
      action: 'UPDATE'
    })

    this.hide()
  }
}
