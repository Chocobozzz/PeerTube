import { mapValues, pickBy } from 'lodash-es'
import { buildVideoLink, buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Notifier } from '@app/core'
import { ABUSE_REASON_VALIDATOR } from '@app/shared/form-validators/abuse-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { abusePredefinedReasonsMap } from '@shared/core-utils/abuse'
import { AbusePredefinedReasonsString } from '@shared/models'
import { Video } from '../../shared-main'
import { AbuseService } from '../abuse.service'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './report.component.scss' ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null
  predefinedReasons: { id: AbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = []
  embedHtml: SafeHtml

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private abuseService: AbuseService,
    private notifier: Notifier,
    private sanitizer: DomSanitizer
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

  getVideoEmbed () {
    return this.sanitizer.bypassSecurityTrustHtml(
      buildVideoOrPlaylistEmbed(
        buildVideoLink({
          baseUrl: this.video.embedUrl,
          title: false,
          warningTitle: false
        }),
        this.video.name
      )
    )
  }

  ngOnInit () {
    this.buildForm({
      reason: ABUSE_REASON_VALIDATOR,
      predefinedReasons: mapValues(abusePredefinedReasonsMap, r => null),
      timestamp: {
        hasStart: null,
        startAt: null,
        hasEnd: null,
        endAt: null
      }
    })

    this.predefinedReasons = this.abuseService.getPrefefinedReasons('video')

    this.embedHtml = this.getVideoEmbed()
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
    }).subscribe(
      () => {
        this.notifier.success($localize`Video reported.`)
        this.hide()
      },

      err => this.notifier.error(err.message)
    )
  }

  isRemote () {
    return !this.video.isLocal
  }
}
