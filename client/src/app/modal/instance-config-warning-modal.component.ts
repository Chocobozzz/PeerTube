import { Location } from '@angular/common'
import { Component, ElementRef, OnInit, inject, output, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier, User, UserService } from '@app/core'
import { AdminConfigService } from '@app/shared/shared-admin/admin-config.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { CustomConfig, ServerConfig } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-instance-config-warning-modal',
  templateUrl: './instance-config-warning-modal.component.html',
  styleUrls: [ './instance-config-warning-modal.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, GlobalIconComponent, PeertubeCheckboxComponent ],
  providers: [ AdminConfigService ]
})
export class InstanceConfigWarningModalComponent implements OnInit {
  private userService = inject(UserService)
  private location = inject(Location)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private adminConfigService = inject(AdminConfigService)

  readonly modal = viewChild<ElementRef>('modal')

  readonly created = output()

  stopDisplayModal = false
  instance: CustomConfig['instance']

  private LS_KEYS = {
    NO_INSTANCE_CONFIG_WARNING_MODAL: 'no_instance_config_warning_modal'
  }

  ngOnInit (): void {
    this.created.emit()
  }

  canBeOpenByUser (user: User) {
    if (this.modalService.hasOpenModals()) return false
    if (user.noInstanceConfigWarningModal === true) return false
    if (peertubeLocalStorage.getItem(this.LS_KEYS.NO_INSTANCE_CONFIG_WARNING_MODAL) === 'true') return false

    return true
  }

  // About information is translated in the language of the interface: use the custom config instead
  showIfNeeded (serverConfig: ServerConfig) {
    if (!serverConfig.signup.allowed) return
    if (this.location.path().startsWith('/admin/settings/config/edit-custom')) return

    this.adminConfigService.getCustomConfig()
      .subscribe(customConfig => {
        if (this.modalService.hasOpenModals()) return
        if (!this.hasMissingInformation(customConfig.instance)) return

        this.instance = customConfig.instance

        const ref = this.modalService.open(this.modal(), { centered: true })

        ref.result.finally(() => {
          if (this.stopDisplayModal === true) this.doNotOpenAgain()
        })
      })
  }

  isDefaultShortDescription (description: string) {
    return description === 'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
  }

  private hasMissingInformation (instance: CustomConfig['instance']) {
    return instance.name.toLowerCase() === 'peertube' ||
      !instance.terms ||
      !instance.administrator ||
      !instance.maintenanceLifetime
  }

  private doNotOpenAgain () {
    peertubeLocalStorage.setItem(this.LS_KEYS.NO_INSTANCE_CONFIG_WARNING_MODAL, 'true')

    this.userService.updateMyProfile({ noInstanceConfigWarningModal: true })
      .subscribe({
        next: () => logger.info('We will not open the instance config warning modal again.'),

        error: err => this.notifier.handleError(err)
      })
  }
}
