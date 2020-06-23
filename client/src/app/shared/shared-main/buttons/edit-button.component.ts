import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-edit-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './edit-button.component.html'
})

export class EditButtonComponent {
  @Input() label: string
  @Input() routerLink: string[] | string = []
}
