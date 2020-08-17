import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { DOMAINS_VALIDATOR, getNotEmptyHosts } from '../form-validators/batch-domains-validators'

@Component({
  selector: 'my-batch-domains-modal',
  templateUrl: './batch-domains-modal.component.html',
  styleUrls: [ './batch-domains-modal.component.scss' ]
})
export class BatchDomainsModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal
  @Input() placeholder = 'example.com'
  @Input() action: string
  @Output() domains = new EventEmitter<string[]>()

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal
  ) {
    super()
  }

  ngOnInit () {
    if (!this.action) this.action = $localize`Process domains`

    this.buildForm({
      domains: DOMAINS_VALIDATOR
    })
  }

  openModal () {
    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.openedModal.close()
  }

  submit () {
    this.domains.emit(
      getNotEmptyHosts(this.form.controls['domains'].value)
    )
    this.form.reset()
    this.hide()
  }
}
