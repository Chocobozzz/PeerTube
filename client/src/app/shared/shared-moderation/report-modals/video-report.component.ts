import { mapValues, pickBy } from 'lodash-es'
import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { ABUSE_REASON_VALIDATOR } from '@app/shared/form-validators/abuse-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { abusePredefinedReasonsMap } from '@peertube/peertube-core-utils'
import { AbusePredefinedReasonsString } from '@peertube/peertube-models'
import { AbuseService } from '../abuse.service'
import { TimestampInputComponent } from '../../shared-forms/timestamp-input.component'
import { EmbedComponent } from '../../shared-main/video/embed.component'
import { PeerTubeTemplateDirective } from '../../shared-main/common/peertube-template.directive'
import { PeertubeCheckboxComponent } from '../../shared-forms/peertube-checkbox.component'
import { NgFor, NgIf, NgClass } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './report.component.scss' ],
  imports: [
    GlobalIconComponent,
    FormsModule,
    ReactiveFormsModule,
    NgFor,
    PeertubeCheckboxComponent,
    NgIf,
    PeerTubeTemplateDirective,
    EmbedComponent,
    TimestampInputComponent,
    NgClass
  ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null
  predefinedReasons: { id: AbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = []

  private openedModal: NgbModalRef

  constructor (
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal,
    private abuseService: AbuseService,
    private notifier: Notifier
  ) {
    super()
  }

  get currentHost () {
    return window.location.host
  }

  get originHost () {
    if (this.isRemote()) {
      return this.video.account.host
    }

    return ''
  }

  get timestamp () {
    return this.form.get('timestamp').value
  }

  ngOnInit () {
    this.buildForm({
      reason: ABUSE_REASON_VALIDATOR,
      predefinedReasons: mapValues(abusePredefinedReasonsMap, _ => null as any),
      timestamp: {
        hasStart: null,
        startAt: null,
        hasEnd: null,
        endAt: null
      }
    })

    this.predefinedReasons = this.abuseService.getPrefefinedReasons('video')
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false, size: 'lg' })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  report () {
    const reason = this.form.get('reason').value
    const predefinedReasons = Object.keys(pickBy(this.form.get('predefinedReasons').value)) as AbusePredefinedReasonsString[]
    const { hasStart, startAt, hasEnd, endAt } = this.form.get('timestamp').value

    this.abuseService.reportVideo({
      reason,
      predefinedReasons,
      video: {
        id: this.video.id,
        startAt: hasStart && startAt ? startAt : undefined,
        endAt: hasEnd && endAt ? endAt : undefined
      }
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Video reported.`)
        this.hide()
      },

      error: err => this.notifier.error(err.message)
    })
  }

  isRemote () {
    return !this.video.isLocal
  }
}
