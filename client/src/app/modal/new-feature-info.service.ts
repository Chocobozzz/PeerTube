import { Injectable, inject } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { UserNewFeatureInfo } from '@peertube/peertube-models'
import { first } from 'rxjs'
import { NewFeatureInfoModalComponent } from './new-feature-info-modal.component'

const channelCollaborationImg = require('../../assets/images/feature-modal/channel-collaboration.svg')

@Injectable({ providedIn: 'root' })
export class NewFeatureInfoService {
  private auth = inject(AuthService)
  private modalService = inject(NgbModal)
  private serverService = inject(ServerService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)
  private domSanitizer = inject(DomSanitizer)

  showChannelCollaboration () {
    this.auth.userInformationLoaded.pipe(first()).subscribe(() => {
      const config = this.serverService.getHTMLConfig()
      if (config.client.newFeaturesInfo !== true) return

      const user = this.auth.getUser()
      if (user.newFeaturesInfoRead & UserNewFeatureInfo.CHANNEL_COLLABORATION) return

      if (this.modalService.hasOpenModals()) return

      const instanceName = this.serverService.getHTMLConfig().instance.name

      const modalRef = this.modalService.open(NewFeatureInfoModalComponent, { size: 'lg', centered: true })
      const component = modalRef.componentInstance as NewFeatureInfoModalComponent

      component.title = $localize`Collaboration on channels are coming to ${instanceName}`
      component.html = $localize`You can now <strong>invite other users</strong> to collaborate on your channel`
      component.svg = this.domSanitizer.bypassSecurityTrustHtml(channelCollaborationImg)

      modalRef.result.finally(() => {
        this.userService.markNewFeatureInfoAsRead(UserNewFeatureInfo.CHANNEL_COLLABORATION)
          .subscribe({
            next: () => this.auth.refreshUserInformation(),

            error: err => this.notifier.error(err.message)
          })
      })
    })
  }
}
