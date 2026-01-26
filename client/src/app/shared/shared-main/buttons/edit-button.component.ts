import { ChangeDetectionStrategy, Component, OnChanges, input, model } from '@angular/core'
import { ButtonComponent } from './button.component'

@Component({
  selector: 'my-edit-button',
  template: `
    <my-button
      icon="edit" [label]="label()" [title]="title()" [responsiveLabel]="responsiveLabel()"
      [ptRouterLink]="ptRouterLink()"
    ></my-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ButtonComponent ]
})
export class EditButtonComponent implements OnChanges {
  readonly label = model<string>(undefined)
  readonly title = model<string>(undefined)
  readonly ptRouterLink = input<string[] | string>([])
  readonly responsiveLabel = input(false)

  ngOnChanges () {
    // <my-edit-button /> No label
    const label = this.label()
    if (label === undefined && !this.title()) {
      this.title.set($localize`Update`)
    }

    // <my-edit-button label /> Use default label
    if (label === '') {
      this.label.set($localize`Update`)
    }
  }
}
