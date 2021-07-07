import { Location } from '@angular/common'
import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
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

  private LOCAL_STORAGE_KEYS = {
    NO_INSTANCE_CONFIG_WARNING_MODAL: 'no_instance_config_warning_modal'
  }

  constructor (
    private userService: UserService,
    private location: Location,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  show (about: About) {
    const result = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_KEYS.NO_INSTANCE_CONFIG_WARNING_MODAL)
    if (result === 'true') return

    if (this.location.path().startsWith('/admin/config/edit-custom')) return

    this.about = about

    const ref = this.modalService.open(this.modal, { centered: true })

    ref.result.finally(() => {
      if (this.stopDisplayModal === true) this.doNotOpenAgain()
    })
  }

  isDefaultShortDescription (description: string) {
    return description === 'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
  }

  private doNotOpenAgain () {
    peertubeLocalStorage.setItem(this.LOCAL_STORAGE_KEYS.NO_INSTANCE_CONFIG_WARNING_MODAL, 'true')

    this.userService.updateMyProfile({ noInstanceConfigWarningModal: true })
        .subscribe(
          () => console.log('We will not open the instance config warning modal again.'),

          err => this.notifier.error(err.message)
        )
  }
}
