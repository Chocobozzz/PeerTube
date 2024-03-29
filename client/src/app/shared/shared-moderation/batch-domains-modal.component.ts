import { NgClass, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { UNIQUE_HOSTS_VALIDATOR } from '../form-validators/host-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-batch-domains-modal',
  templateUrl: './batch-domains-modal.component.html',
  styleUrls: [ './batch-domains-modal.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, NgIf ]
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
