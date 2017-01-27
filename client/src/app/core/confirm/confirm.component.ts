import { Component, HostListener, OnInit, ViewChild } from '@angular/core';

import { ModalDirective } from 'ng2-bootstrap/modal';

import { ConfirmService } from './confirm.service';

export interface ConfigChangedEvent {
  columns: { [id: string]: { isDisplayed: boolean }; };
  config: { resultsPerPage: number };
}

@Component({
  selector: 'my-confirm',
  templateUrl: './confirm.component.html'
})
export class ConfirmComponent implements OnInit {
  @ViewChild('confirmModal') confirmModal: ModalDirective;

  title = '';
  message = '';

  constructor (private confirmService: ConfirmService) {
    // Empty
  }

  ngOnInit() {
    this.confirmModal.config = {
      backdrop: 'static',
      keyboard: false
    };

    this.confirmService.showConfirm.subscribe(
      ({ title, message }) => {
        this.title = title;
        this.message = message;

        this.showModal();
      }
    );
  }

  @HostListener('keydown.enter')
  confirm() {
    this.confirmService.confirmResponse.next(true);
    this.hideModal();
  }

  @HostListener('keydown.esc')
  abort() {
    this.confirmService.confirmResponse.next(false);
    this.hideModal();
  }

  showModal() {
    this.confirmModal.show();
  }

  hideModal() {
    this.confirmModal.hide();
  }
}
