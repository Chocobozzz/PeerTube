import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { UNIQUE_HOSTS_VALIDATOR } from '../form-validators/host-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-batch-domains-modal',
  templateUrl: './batch-domains-modal.component.html',
  styleUrls: [ './batch-domains-modal.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass ]
})
export class BatchDomainsModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)

  readonly modal = viewChild<NgbModal>('modal')
  readonly placeholder = input('example.com')
  readonly action = input<string>($localize`Process domains`)
  readonly domains = output<string[]>()

  private openedModal: NgbModalRef

  ngOnInit () {
    this.buildForm({
      hosts: UNIQUE_HOSTS_VALIDATOR
    })
  }

  openModal () {
    this.openedModal = this.modalService.open(this.modal(), { centered: true })
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
