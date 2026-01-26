import { Component, inject } from '@angular/core'
import { VideoManageController } from '../video-manage-controller.service'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { RouterModule } from '@angular/router'

@Component({
  selector: 'my-manage-errors',
  templateUrl: 'manage-errors.component.html',
  imports: [ RouterModule, AlertComponent ]
})
export class ManageErrorsComponent {
  private readonly manageController = inject(VideoManageController)

  getAllErrors () {
    return this.manageController.getFormErrors()
  }
}
