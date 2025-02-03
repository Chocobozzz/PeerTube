import { CommonModule } from '@angular/common'
import { Component, Input, numberAttribute } from '@angular/core'
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
  @Input({ required: true, transform: numberAttribute }) value: number
  @Input({ required: true }) label: string

  @Input({ required: true }) valueFormatted: string | number

  @Input() maxFormatted: string

  @Input() size: 'normal' | 'small' = 'normal'

  @Input({ transform: numberAttribute }) max = 100
  @Input({ transform: numberAttribute }) min = 0

  @Input() theme: 'green' | 'red' | 'main' = 'main'

  percentage () {
    return this.value * 100 / this.max
  }
}
