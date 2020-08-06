import { mapValues, pickBy } from 'lodash-es'
import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { AbuseValidatorsService, FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { Account } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { abusePredefinedReasonsMap } from '@shared/core-utils/abuse'
import { AbusePredefinedReasonsString } from '@shared/models'
import { AbuseService } from '../abuse.service'

@Component({
  selector: 'my-account-report',
  templateUrl: './report.component.html',
  styleUrls: [ './report.component.scss' ]
})
export class AccountReportComponent extends FormReactive implements OnInit {
  @Input() account: Account = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null
  predefinedReasons: { id: AbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = []
  modalTitle: string

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private abuseValidatorsService: AbuseValidatorsService,
    private abuseService: AbuseService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  get currentHost () {
    return window.location.host
  }

  get originHost () {
    if (this.isRemote()) {
      return this.account.host
    }

    return ''
  }

  ngOnInit () {
    this.modalTitle = this.i18n('Report {{displayName}}', { displayName: this.account.displayName })

    this.buildForm({
      reason: this.abuseValidatorsService.ABUSE_REASON,
      predefinedReasons: mapValues(abusePredefinedReasonsMap, r => null)
    })

    this.predefinedReasons = this.abuseService.getPrefefinedReasons('account')
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

    this.abuseService.reportVideo({
      reason,
      predefinedReasons,
      account: {
        id: this.account.id
      }
    }).subscribe(
      () => {
        this.notifier.success(this.i18n('Account reported.'))
        this.hide()
      },

      err => this.notifier.error(err.message)
    )
  }

  isRemote () {
    return !this.account.isLocal
  }
}
