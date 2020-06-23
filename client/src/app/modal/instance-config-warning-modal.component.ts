import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { About } from '@shared/models/server'

@Component({
  selector: 'my-instance-config-warning-modal',
  templateUrl: './instance-config-warning-modal.component.html',
  styleUrls: [ './instance-config-warning-modal.component.scss' ]
})
export class InstanceConfigWarningModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  stopDisplayModal = false
  about: About

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  show (about: About) {
    this.about = about

    const ref = this.modalService.open(this.modal, { centered: true })

    ref.result.finally(() => {
      if (this.stopDisplayModal === true) this.doNotOpenAgain()
    })
  }

  isDefaultShortDescription (description: string) {
    return description === 'PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly ' +
      'in the web browser with WebTorrent and Angular.'
  }

  private doNotOpenAgain () {
    this.userService.updateMyProfile({ noInstanceConfigWarningModal: true })
        .subscribe(
          () => console.log('We will not open the instance config warning modal again.'),

          err => this.notifier.error(err.message)
        )
  }
}
