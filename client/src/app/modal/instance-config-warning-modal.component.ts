import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-instance-config-warning-modal',
  templateUrl: './instance-config-warning-modal.component.html',
  styleUrls: [ './instance-config-warning-modal.component.scss' ]
})
export class InstanceConfigWarningModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  constructor (
    private modalService: NgbModal,
    private notifier: Notifier,
    private i18n: I18n
  ) { }

  show () {
    this.modalService.open(this.modal)
  }
}
