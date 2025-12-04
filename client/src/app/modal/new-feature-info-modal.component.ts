import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { SafeHtml } from '@angular/platform-browser'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-new-feature-info-modal',
  templateUrl: './new-feature-info-modal.component.html',
  styleUrls: [ './new-feature-info-modal.component.scss' ],
  imports: [ FormsModule ]
})
export class NewFeatureInfoModalComponent {
  activeModal = inject(NgbActiveModal)

  title: string
  html: string
  svg: SafeHtml
}
