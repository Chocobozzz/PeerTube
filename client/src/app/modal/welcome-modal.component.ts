import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  styleUrls: [ './welcome-modal.component.scss' ]
})
export class WelcomeModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  private LOCAL_STORAGE_KEYS = {
    NO_WELCOME_MODAL: 'no_welcome_modal'
  }

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  show () {
    const result = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_KEYS.NO_WELCOME_MODAL)
    if (result === 'true') return

    this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }

  doNotOpenAgain () {
    peertubeLocalStorage.setItem(this.LOCAL_STORAGE_KEYS.NO_WELCOME_MODAL, 'true')

    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe(
        () => console.log('We will not open the welcome modal again.'),

        err => this.notifier.error(err.message)
      )
  }
}
