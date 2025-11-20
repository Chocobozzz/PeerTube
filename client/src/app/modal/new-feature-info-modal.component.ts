import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-new-feature-info-modal',
  templateUrl: './new-feature-info-modal.component.html',
  styleUrls: [ './new-feature-info-modal.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule ]
})
export class NewFeatureInfoModalComponent {
  activeModal = inject(NgbActiveModal)

  title: string
  iconName: GlobalIconName
  html: string
}
