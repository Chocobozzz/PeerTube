import { CommonModule, Location } from '@angular/common'
import { Component, ElementRef, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier, User, UserService } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { About, ServerConfig } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-instance-config-warning-modal',
  templateUrl: './instance-config-warning-modal.component.html',
  styleUrls: [ './instance-config-warning-modal.component.scss' ],
  standalone: true,
  imports: [ CommonModule, FormsModule, GlobalIconComponent, PeertubeCheckboxComponent ]
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

  shouldOpenByUser (user: User) {
    if (user.noInstanceConfigWarningModal === true) return false
    if (peertubeLocalStorage.getItem(this.LOCAL_STORAGE_KEYS.NO_INSTANCE_CONFIG_WARNING_MODAL) === 'true') return false

    return true
  }

  shouldOpen (serverConfig: ServerConfig, about: About) {
    if (!serverConfig.signup.allowed) return false

    return serverConfig.instance.name.toLowerCase() === 'peertube' ||
      !about.instance.terms ||
      !about.instance.administrator ||
      !about.instance.maintenanceLifetime
  }

  show (about: About) {
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
        .subscribe({
          next: () => logger.info('We will not open the instance config warning modal again.'),

          error: err => this.notifier.error(err.message)
        })
  }
}
