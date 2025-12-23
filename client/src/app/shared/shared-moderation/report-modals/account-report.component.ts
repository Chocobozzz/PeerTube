import { NgClass } from '@angular/common'
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { ABUSE_REASON_VALIDATOR } from '@app/shared/form-validators/abuse-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { Account } from '@app/shared/shared-main/account/account.model'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { abusePredefinedReasonsMap } from '@peertube/peertube-core-utils'
import { AbusePredefinedReasonsString } from '@peertube/peertube-models'
import { mapValues, pickBy } from 'lodash-es'
import { PeertubeCheckboxComponent } from '../../shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../../shared-main/common/peertube-template.directive'
import { AbuseService } from '../abuse.service'

@Component({
  selector: 'my-account-report',
  templateUrl: './report.component.html',
  styleUrls: [ './report.component.scss' ],
  imports: [
    GlobalIconComponent,
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    NgClass
  ]
})
export class AccountReportComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private abuseService = inject(AbuseService)
  private notifier = inject(Notifier)

  readonly modal = viewChild<NgbModal>('modal')

  error: string = null
  predefinedReasons: { id: AbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = []
  modalTitle: string
  account: Account = null

  private openedModal: NgbModalRef

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
    this.buildForm({
      reason: ABUSE_REASON_VALIDATOR,
      predefinedReasons: mapValues(abusePredefinedReasonsMap, _ => null as any)
    })

    this.predefinedReasons = this.abuseService.getPrefefinedReasons('account')
  }

  show (account: Account) {
    this.account = account

    this.modalTitle = $localize`Report ${this.account.displayName}`

    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false, size: 'lg' })
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
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Account reported.`)
        this.hide()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  isRemote () {
    return !this.account.isLocal
  }
}
