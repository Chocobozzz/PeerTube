import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { splitAndGetNotEmpty, UNIQUE_HOSTS_VALIDATOR } from '../form-validators/host-validators'

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
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal
  ) {
    super()
  }

  ngOnInit () {
    if (!this.action) this.action = $localize`Process domains`

    this.buildForm({
      hosts: UNIQUE_HOSTS_VALIDATOR
    })
  }

  openModal () {
    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.openedModal.close()
  }

  submit () {
    this.domains.emit(splitAndGetNotEmpty(this.form.controls['hosts'].value))
    this.form.reset()
    this.hide()
  }
}
