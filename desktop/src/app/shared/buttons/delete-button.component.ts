import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-delete-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './delete-button.component.html'
})

export class DeleteButtonComponent {
  @Input() label: string
}
