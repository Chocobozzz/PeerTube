import { Component, ElementRef, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { VIDEO_CAPTION_FILE_VALIDATOR, VIDEO_CAPTION_LANGUAGE_VALIDATOR } from '@app/shared/form-validators/video-captions-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { VideoCaptionEdit } from '@app/+videos-publish-manage/shared-manage/common/video-caption-edit.model'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, VideoConstant } from '@peertube/peertube-models'
import { ReactiveFileComponent } from '../../../shared/shared-forms/reactive-file.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-video-caption-add-modal',
  styleUrls: [ './video-caption-add-modal.component.scss' ],
  templateUrl: './video-caption-add-modal.component.html',
  imports: [ FormsModule, ReactiveFormsModule, GlobalIconComponent, ReactiveFileComponent, SelectOptionsComponent ]
})
export class VideoCaptionAddModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private serverService = inject(ServerService)

  readonly existingCaptions = input<string[]>(undefined)
  readonly serverConfig = input<HTMLServerConfig>(undefined)

  readonly captionAdded = output<VideoCaptionEdit>()

  readonly modal = viewChild<ElementRef>('modal')

  videoCaptionLanguages: VideoConstant<string>[] = []

  private openedModal: NgbModalRef

  get videoCaptionExtensions () {
    return this.serverConfig().videoCaption.file.extensions
  }

  get videoCaptionMaxSize () {
    return this.serverConfig().videoCaption.file.size.max
  }

  getReactiveFileButtonTooltip () {
    return `(extensions: ${this.videoCaptionExtensions.join(', ')})`
  }

  ngOnInit () {
    this.serverService.getVideoLanguages()
      .subscribe(languages => this.videoCaptionLanguages = languages)

    this.buildForm({
      language: VIDEO_CAPTION_LANGUAGE_VALIDATOR,
      captionfile: VIDEO_CAPTION_FILE_VALIDATOR
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.form.reset()
  }

  isReplacingExistingCaption () {
    const languageId = this.form.value['language']

    return languageId && this.existingCaptions().includes(languageId)
  }

  addCaption () {
    const languageId = this.form.value['language']
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)

    this.captionAdded.emit({
      language: languageObject,
      captionfile: this.form.value['captionfile'],
      action: 'CREATE'
    })

    this.hide()
  }
}
