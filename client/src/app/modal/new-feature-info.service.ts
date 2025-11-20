import { Injectable, inject } from '@angular/core'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { UserNewFeatureInfo } from '@peertube/peertube-models'
import { NewFeatureInfoModalComponent } from './new-feature-info-modal.component'

@Injectable({ providedIn: 'root' })
export class NewFeatureInfoService {
  private auth = inject(AuthService)
  private modalService = inject(NgbModal)
  private serverService = inject(ServerService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  showChannelCollaboration () {
    this.auth.userInformationLoaded.subscribe(() => {
      const config = this.serverService.getHTMLConfig()
      if (config.client.newFeaturesInfo !== true) return

      const user = this.auth.getUser()
      if (user.newFeaturesInfoRead & UserNewFeatureInfo.CHANNEL_COLLABORATION) return

      const instanceName = this.serverService.getHTMLConfig().instance.name

      const modalRef = this.modalService.open(NewFeatureInfoModalComponent, { size: 'lg', centered: true })
      const component = modalRef.componentInstance as NewFeatureInfoModalComponent

      component.title = $localize`Collaborations on channels are coming to ${instanceName}`
      component.iconName = 'channel'
      component.html = $localize`You can now <strong>invite other users</strong> to collaborate on your channel`

      modalRef.result.finally(() => {
        this.userService.markNewFeatureInfoAsRead(UserNewFeatureInfo.CHANNEL_COLLABORATION)
          .subscribe({
            next: () => {
              // empty
            },

            error: err => this.notifier.error(err.message)
          })
      })
    })
  }
}
