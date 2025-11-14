import { NgClass } from '@angular/common'
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms'
import { VIDEO_CHAPTERS_ARRAY_VALIDATOR, VIDEO_CHAPTER_TITLE_VALIDATOR } from '@app/shared/form-validators/video-chapter-validators'
import { FormReactiveErrors, FormReactiveService, FormReactiveMessages } from '@app/shared/shared-forms/form-reactive.service'
import { FormValidatorService } from '@app/shared/shared-forms/form-validator.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { TimestampInputComponent } from '../../../shared/shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type ChapterForm = {
  timecode: FormControl<number>
  title: FormControl<string>
}

type Form = {
  chapters: FormArray<FormGroup<ChapterForm>>
}

@Component({
  selector: 'my-video-chapters',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-chapters.component.scss'
  ],
  templateUrl: './video-chapters.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NgClass,
    TimestampInputComponent,
    DeleteButtonComponent,
    EmbedComponent,
    AlertComponent,
    GlobalIconComponent
  ]
})
export class VideoChaptersComponent implements OnInit, OnDestroy {
  private formValidatorService = inject(FormValidatorService)
  private formReactiveService = inject(FormReactiveService)
  private manageController = inject(VideoManageController)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors & { chapters?: { title: string }[] } = {}
  validationMessages: FormReactiveMessages = {}

  videoEdit: VideoEdit

  private updatedSub: Subscription

  ngOnInit () {
    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit

    this.buildForm()
  }

  private buildForm () {
    const { form, formErrors, validationMessages } = this.formReactiveService.buildForm<Form>({}, {})
    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.addControl('chapters', new FormArray([], VIDEO_CHAPTERS_ARRAY_VALIDATOR.VALIDATORS))
    this.addNewChapterControl()

    form.get('chapters').valueChanges.subscribe(chapters => {
      const lastChapter = chapters[chapters.length - 1]

      if (lastChapter.title || lastChapter.timecode) {
        this.addNewChapterControl()
      }
    })

    this.patchChapters()

    this.form.valueChanges.subscribe(() => {
      const chapterErrors = {
        chapters: !this.form.valid
          ? $localize`Some chapters are invalid`
          : undefined
      }

      this.manageController.setFormError($localize`Chapters`, 'chapters', chapterErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      this.videoEdit.getChaptersEdit().loadFromForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.patchChapters()
    })
  }

  ngOnDestroy () {
    this.updatedSub?.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  addNewChapterControl () {
    const chaptersFormArray = this.getChaptersFormArray()
    const controls = chaptersFormArray.controls

    if (controls.length !== 0) {
      const lastControl = chaptersFormArray.controls[controls.length - 1]
      lastControl.get('title').addValidators(Validators.required)
    }

    this.formValidatorService.addControlInFormArray({
      controlName: 'chapters',
      formArray: chaptersFormArray,
      formErrors: this.formErrors,
      validationMessages: this.validationMessages,
      formToBuild: {
        timecode: null,
        title: VIDEO_CHAPTER_TITLE_VALIDATOR
      },
      defaultValues: {
        timecode: 0
      }
    })
  }

  getChaptersFormArray () {
    return this.form.controls.chapters
  }

  deleteChapterControl (index: number) {
    this.formValidatorService.removeControlFromFormArray({
      controlName: 'chapters',
      formArray: this.getChaptersFormArray(),
      formErrors: this.formErrors,
      validationMessages: this.validationMessages,
      index
    })
  }

  isLastChapterControl (index: number) {
    return this.getChaptersFormArray().length - 1 === index
  }

  getChapterArrayErrors () {
    if (!this.getChaptersFormArray().errors) return ''

    return Object.values(this.getChaptersFormArray().errors).join('. ')
  }

  private patchChapters () {
    const chaptersEdit = this.videoEdit.getChaptersEdit()

    const totalChapters = chaptersEdit.getChaptersForUpdate().length
    const totalControls = this.getChaptersFormArray().length

    // Add missing controls. We use <= because we need the "empty control" to add another chapter
    for (let i = 0; i <= totalChapters - totalControls; i++) {
      this.addNewChapterControl()
    }

    this.form.patchValue(chaptersEdit.toFormPatch())
  }

  isLive () {
    return this.videoEdit.getVideoAttributes().isLive
  }

  getEmbedVersion () {
    return this.manageController.getEmbedVersion()
  }
}
