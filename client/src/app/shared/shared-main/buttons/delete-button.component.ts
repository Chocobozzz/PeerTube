import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core'
import { ButtonComponent } from './button.component'

@Component({
  selector: 'my-delete-button',
  template: `
    <my-button
      icon="delete" theme="secondary"
      [disabled]="disabled" [label]="label" [title]="title"
      [responsiveLabel]="responsiveLabel"
    ></my-button>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ButtonComponent ]
})
export class DeleteButtonComponent implements OnChanges {
  @Input() label: string
  @Input() title: string
  @Input() responsiveLabel = false
  @Input() disabled: boolean

  ngOnChanges () {
    if (this.label === undefined && !this.title) {
      this.title = $localize`Delete`
    }

    // <my-delete-button label /> Use default label
    if (this.label === '') {
      this.label = $localize`Delete`
    }
  }
}
