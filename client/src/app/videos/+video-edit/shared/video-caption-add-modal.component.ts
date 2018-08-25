import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormReactive } from '@app/shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoCaptionsValidatorsService } from '@app/shared/forms/form-validators/video-captions-validators.service'
import { ServerService } from '@app/core'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-caption-add-modal',
  styleUrls: [ './video-caption-add-modal.component.scss' ],
  templateUrl: './video-caption-add-modal.component.html'
})

export class VideoCaptionAddModalComponent extends FormReactive implements OnInit {
  @Input() existingCaptions: string[]

  @Output() captionAdded = new EventEmitter<VideoCaptionEdit>()

  @ViewChild('modal') modal: ElementRef

  videoCaptionLanguages = []

  private openedModal: NgbModalRef
  private closingModal = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private serverService: ServerService,
    private videoCaptionsValidatorsService: VideoCaptionsValidatorsService
  ) {
    super()
  }

  get videoCaptionExtensions () {
    return this.serverService.getConfig().videoCaption.file.extensions
  }

  get videoCaptionMaxSize () {
    return this.serverService.getConfig().videoCaption.file.size.max
  }

  ngOnInit () {
    this.videoCaptionLanguages = this.serverService.getVideoLanguages()

    this.buildForm({
      language: this.videoCaptionsValidatorsService.VIDEO_CAPTION_LANGUAGE,
      captionfile: this.videoCaptionsValidatorsService.VIDEO_CAPTION_FILE
    })
  }

  show () {
    this.closingModal = false

    this.openedModal = this.modalService.open(this.modal, { keyboard: false })
  }

  hide () {
    this.closingModal = true
    this.openedModal.close()
  }

  isReplacingExistingCaption () {
    if (this.closingModal === true) return false

    const languageId = this.form.value[ 'language' ]

    return languageId && this.existingCaptions.indexOf(languageId) !== -1
  }

  async addCaption () {
    this.hide()

    const languageId = this.form.value[ 'language' ]
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)

    this.captionAdded.emit({
      language: languageObject,
      captionfile: this.form.value[ 'captionfile' ]
    })

    this.form.reset()
  }
}
