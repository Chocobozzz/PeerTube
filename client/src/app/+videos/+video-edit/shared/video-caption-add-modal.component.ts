import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { ServerService } from '@app/core'
import { FormReactive, FormValidatorService, VideoCaptionsValidatorsService } from '@app/shared/shared-forms'
import { VideoCaptionEdit } from '@app/shared/shared-main'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { ServerConfig, VideoConstant } from '@shared/models'

@Component({
  selector: 'my-video-caption-add-modal',
  styleUrls: [ './video-caption-add-modal.component.scss' ],
  templateUrl: './video-caption-add-modal.component.html'
})

export class VideoCaptionAddModalComponent extends FormReactive implements OnInit {
  @Input() existingCaptions: string[]
  @Input() serverConfig: ServerConfig

  @Output() captionAdded = new EventEmitter<VideoCaptionEdit>()

  @ViewChild('modal', { static: true }) modal: ElementRef

  videoCaptionLanguages: VideoConstant<string>[] = []

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
    return this.serverConfig.videoCaption.file.extensions
  }

  get videoCaptionMaxSize () {
    return this.serverConfig.videoCaption.file.size.max
  }

  ngOnInit () {
    this.serverService.getVideoLanguages()
        .subscribe(languages => this.videoCaptionLanguages = languages)

    this.buildForm({
      language: this.videoCaptionsValidatorsService.VIDEO_CAPTION_LANGUAGE,
      captionfile: this.videoCaptionsValidatorsService.VIDEO_CAPTION_FILE
    })
  }

  show () {
    this.closingModal = false

    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
  }

  hide () {
    this.closingModal = true
    this.openedModal.close()
    this.form.reset()
  }

  isReplacingExistingCaption () {
    if (this.closingModal === true) return false

    const languageId = this.form.value[ 'language' ]

    return languageId && this.existingCaptions.indexOf(languageId) !== -1
  }

  async addCaption () {
    const languageId = this.form.value[ 'language' ]
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)

    this.captionAdded.emit({
      language: languageObject,
      captionfile: this.form.value[ 'captionfile' ]
    })

    this.hide()
  }
}
