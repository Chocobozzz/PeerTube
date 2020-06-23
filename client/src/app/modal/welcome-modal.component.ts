import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  styleUrls: [ './welcome-modal.component.scss' ]
})
export class WelcomeModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  show () {
    this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }

  doNotOpenAgain () {
    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe(
        () => console.log('We will not open the welcome modal again.'),

        err => this.notifier.error(err.message)
      )
  }
}
