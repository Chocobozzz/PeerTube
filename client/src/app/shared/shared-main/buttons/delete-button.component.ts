import { ChangeDetectionStrategy, Component, OnChanges, input, model } from '@angular/core'
import { ButtonComponent, ButtonTheme } from './button.component'

@Component({
  selector: 'my-delete-button',
  template: `
    <my-button
      icon="delete" theme="secondary"
      [disabled]="disabled()" [label]="label()" [title]="title()"
      [responsiveLabel]="responsiveLabel()" [theme]="theme()"
    ></my-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ButtonComponent ]
})
export class DeleteButtonComponent implements OnChanges {
  readonly label = model<string>(undefined)
  readonly title = model<string>(undefined)
  readonly responsiveLabel = input(false)
  readonly disabled = input<boolean>(undefined)
  readonly theme = input<ButtonTheme>('secondary')

  ngOnChanges () {
    const label = this.label()
    if (label === undefined && !this.title()) {
      this.title.set($localize`Delete`)
    }

    // <my-delete-button label /> Use default label
    if (label === '') {
      this.label.set($localize`Delete`)
    }
  }
}
