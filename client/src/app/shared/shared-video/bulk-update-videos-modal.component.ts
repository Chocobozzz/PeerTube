import { CdkStepperModule } from '@angular/cdk/stepper'
import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { form, FormField, required } from '@angular/forms/signals'
import { AuthService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { listUserChannelsForSelect } from '@app/helpers/utils/channel'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal'
import { ConstantLabel, Video, VideoCommentPolicyType, VideoPrivacy, VideoPrivacyType, VideoUpdate } from '@peertube/peertube-models'
import { SelectChannelItem } from '@pt-types'
import { concatMap, from, toArray } from 'rxjs'
import { videoSupportValidator } from '../form-validators/video-validators'
import { FormErrorComponent } from '../shared-forms/form-error.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectChannelComponent } from '../shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '../shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { CommonStepperComponent } from '../shared-main/common/common-stepper.component'
import { VideoService } from '../shared-main/video/video.service'

type BulkVideoUpdateModel = {
  channelId: number | null
  language: string | null
  category: number | null
  support: string | null
  privacy: VideoPrivacyType | null
  licence: number | null
  downloadEnabled: boolean
  commentsPolicy: VideoCommentPolicyType | null
}

type FieldName = keyof BulkVideoUpdateModel

type FieldDefinition = {
  key: FieldName
  label: string
}

const BULK_PRIVACY_EXCLUDE = new Set<VideoPrivacyType>([ VideoPrivacy.PASSWORD_PROTECTED ])

@Component({
  selector: 'my-bulk-update-videos-modal',
  styleUrls: [ './bulk-update-videos-modal.component.scss' ],
  templateUrl: './bulk-update-videos-modal.component.html',
  imports: [
    FormsModule,
    CdkStepperModule,
    GlobalIconComponent,
    ButtonComponent,
    SelectOptionsComponent,
    SelectChannelComponent,
    PeertubeCheckboxComponent,
    FormErrorComponent,
    FormField,
    CommonStepperComponent
  ]
})
export class BulkUpdateVideosModalComponent {
  private authService = inject(AuthService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private server = inject(ServerService)
  private videoService = inject(VideoService)

  readonly saved = output()

  readonly modal = viewChild<ElementRef>('modal')

  private openedModal: NgbModalRef

  videos: Video[] = []

  readonly activeFields = signal(new Set<FieldName>())

  private readonly bulkUpdateModel = signal<BulkVideoUpdateModel>({
    channelId: null,
    language: null,
    category: null,
    support: null,
    privacy: null,
    licence: null,
    downloadEnabled: true,
    commentsPolicy: null
  })

  readonly bulkUpdateForm = form(this.bulkUpdateModel, f => {
    required(f.channelId, { when: () => this.activeFields().has('channelId'), message: $localize`Channel is required.` })
    required(f.privacy, { when: () => this.activeFields().has('privacy'), message: $localize`Privacy is required.` })
    required(f.commentsPolicy, { when: () => this.activeFields().has('commentsPolicy'), message: $localize`Comments policy is required.` })

    videoSupportValidator(f.support)
  })

  readonly allFields: FieldDefinition[] = [
    { key: 'category', label: $localize`Category` },
    { key: 'channelId', label: $localize`Channel` },
    { key: 'commentsPolicy', label: $localize`Comment policy` },
    { key: 'downloadEnabled', label: $localize`Enable download` },
    { key: 'language', label: $localize`Language` },
    { key: 'licence', label: $localize`Licence` },
    { key: 'privacy', label: $localize`Privacy` },
    { key: 'support', label: $localize`Support` }
  ]

  readonly activeAvailableFields = computed(() => this.allFields.filter(f => !this.activeFields().has(f.key)))

  readonly isSaving = signal(false)

  userChannels: SelectChannelItem[] = []

  videoCategories: ConstantLabel<number>[] = []
  videoLicences: ConstantLabel<number>[] = []
  videoLanguages: ConstantLabel<string>[] = []
  videoPrivacies: ConstantLabel<VideoPrivacyType>[] = []
  commentPolicies: ConstantLabel<VideoCommentPolicyType>[]

  get authUser () {
    return this.authService.getUser()
  }

  show (options: {
    videos: Video[]
  }) {
    this.videos = options.videos

    // Keep the form and active fields reset when opening the modal so the user can easily re-apply the same update to another set of videos

    this.activeFields.set(new Set())
    this.isSaving.set(false)

    // Load metadata if not yet loaded
    this.server.getVideoCategories().subscribe(categories => this.videoCategories = categories)
    this.server.getVideoLicences().subscribe(licences => this.videoLicences = licences)
    this.server.getVideoLanguages().subscribe(languages => this.videoLanguages = languages)
    this.server.getCommentPolicies().subscribe(policies => this.commentPolicies = policies)

    this.server.getVideoPrivacies().subscribe(privacies => {
      this.videoPrivacies = privacies.filter(p => !BULK_PRIVACY_EXCLUDE.has(p.id))
    })

    // Load user channels
    listUserChannelsForSelect(this.authService, { includeCollaborations: true })
      .subscribe(channels => this.userChannels = channels)

    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
  }

  addField (key: FieldName) {
    this.activeFields.update(fields => {
      const newSet = new Set(fields)
      newSet.add(key)

      return newSet
    })
  }

  removeField (key: FieldName) {
    this.activeFields.update(fields => {
      const newSet = new Set(fields)
      newSet.delete(key)
      return newSet
    })

    this.bulkUpdateModel.update(model => ({
      ...model,
      [key]: key === 'downloadEnabled' ? true : null
    }))
  }

  getSelectItemsForField (key: FieldName): ConstantLabel<any>[] {
    switch (key) {
      case 'privacy':
        return this.videoPrivacies
      case 'commentsPolicy':
        return this.commentPolicies
      default:
        return []
    }
  }

  getFieldSummary (key: FieldName) {
    const model = this.bulkUpdateModel()
    const value = model[key]

    if (value === null || value === undefined) return $localize`Not set`

    switch (key) {
      case 'channelId':
        return this.userChannels.find(c => c.id === value)?.label

      case 'language':
        return this.videoLanguages.find(l => l.id === value)?.label

      case 'category':
        return this.videoCategories.find(c => c.id === value)?.label

      case 'licence':
        return this.videoLicences.find(l => l.id === value)?.label

      case 'privacy':
        return this.videoPrivacies.find(p => p.id === value)?.label

      case 'commentsPolicy':
        return this.commentPolicies?.find(p => p.id === value)?.label

      case 'downloadEnabled':
        return value ? $localize`Yes` : $localize`No`

      case 'support':
        return (value as string) || $localize`Not set`

      default:
        return String(value)
    }
  }

  save () {
    const model = this.bulkUpdateModel()
    const active = this.activeFields()

    this.isSaving.set(true)

    const videos = this.videos

    const buildUpdate = (): VideoUpdate => {
      const update: VideoUpdate = {}
      if (active.has('channelId')) update.channelId = model.channelId
      if (active.has('language')) update.language = model.language
      if (active.has('category')) update.category = model.category
      if (active.has('support')) update.support = model.support
      if (active.has('privacy')) update.privacy = model.privacy
      if (active.has('licence')) update.licence = model.licence
      if (active.has('downloadEnabled')) update.downloadEnabled = model.downloadEnabled
      if (active.has('commentsPolicy')) update.commentsPolicy = model.commentsPolicy

      return update
    }

    const updatePayload = buildUpdate()

    from(videos)
      .pipe(
        concatMap(v => this.videoService.updateVideo(v.uuid, updatePayload)),
        toArray()
      ).subscribe({
        next: () => this.onSaveSuccess(),
        error: err => {
          this.isSaving.set(false)

          this.notifier.handleError(err)
        }
      })
  }

  onAddFieldSelect (event: Event) {
    const select = event.target as HTMLSelectElement
    this.addField(select.value as FieldName)
    select.value = ''
  }

  private onSaveSuccess () {
    this.isSaving.set(false)

    const message = formatICU(
      $localize`{count, plural, =1 {1 video updated} other {{count} videos updated}}`,
      { count: this.videos.length }
    )

    this.notifier.success(message)
    this.saved.emit()
    this.hide()
  }
}
