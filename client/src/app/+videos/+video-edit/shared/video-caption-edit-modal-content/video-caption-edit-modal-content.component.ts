import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { VIDEO_CAPTION_FILE_CONTENT_VALIDATOR } from '@app/shared/form-validators/video-captions-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoCaptionWithPathEdit } from '@app/shared/shared-main'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, VideoConstant } from '@shared/models'
import { ServerService } from '../../../../core'

/**
 * https://github.com/valor-software/ngx-bootstrap/issues/3825
 * https://stackblitz.com/edit/angular-t5dfp7
 * https://medium.com/@izzatnadiri/how-to-pass-data-to-and-receive-from-ng-bootstrap-modals-916f2ad5d66e
 */
@Component({
  selector: 'my-video-caption-edit-modal-content',
  styleUrls: [ './video-caption-edit-modal-content.component.scss' ],
  templateUrl: './video-caption-edit-modal-content.component.html'
})

export class VideoCaptionEditModalContentComponent extends FormReactive implements OnInit {
  @Input() videoCaption: VideoCaptionWithPathEdit
  @Input() serverConfig: HTMLServerConfig

  @Output() captionEdited = new EventEmitter<VideoCaptionEdit>()

  @ViewChild('textarea', { static: true }) textarea!: ElementRef

  videoCaptionLanguages: VideoConstant<string>[] = []

  constructor (
    protected openedModal: NgbActiveModal,
    protected formReactiveService: FormReactiveService,
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
    if (!captionPath) return

    this.videoCaptionService.getCaptionContent({ captionPath })
      .subscribe(res => {
        this.form.patchValue({
          captionFileContent: res
        })
        this.resetTextarea()
      })
  }

  resetTextarea () {
    this.textarea.nativeElement.scrollTop = 0
    this.textarea.nativeElement.selectionStart = 0
    this.textarea.nativeElement.selectionEnd = 0
  }

  hide () {
    this.openedModal.close()
  }

  cancel () {
    this.hide()
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
