import { CommonModule } from '@angular/common'
import { Component, numberAttribute, input } from '@angular/core'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-progress-bar',
  styleUrls: [ './progress-bar.component.scss' ],
  templateUrl: './progress-bar.component.html',
  imports: [
    CommonModule,
    NgbTooltip
  ]
})
export class ProgressBarComponent {
  readonly value = input.required<number, unknown>({ transform: numberAttribute })
  readonly label = input.required<string>()

  readonly valueFormatted = input.required<string | number>()

  readonly maxFormatted = input<string>(undefined)

  readonly size = input<'normal' | 'small'>('normal')

  readonly max = input(100, { transform: numberAttribute })
  readonly min = input(0, { transform: numberAttribute })

  readonly theme = input<'green' | 'red' | 'main'>('main')

  percentage () {
    return this.value() * 100 / this.max()
  }
}
