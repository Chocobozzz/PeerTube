import { ChangeDetectionStrategy, Component, OnChanges, inject, input, model } from '@angular/core'
import { FromNowPipe } from './from-now.pipe'

@Component({
  selector: 'my-date-toggle',
  templateUrl: './date-toggle.component.html',
  styleUrls: [ './date-toggle.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DateToggleComponent implements OnChanges {
  private fromNowPipe = inject(FromNowPipe)

  readonly date = input<Date>(undefined)
  readonly toggled = model(false)

  dateRelative: string
  dateAbsolute: string

  ngOnChanges () {
    this.updateDates()
  }

  toggle () {
    this.toggled.update(toggled => !toggled)
  }

  getTitle () {
    const target = this.toggled()
      ? this.dateRelative
      : this.dateAbsolute

    return $localize`Toggle this date format to "${target}"`
  }

  getContent () {
    return this.toggled()
      ? this.dateAbsolute
      : this.dateRelative
  }

  private updateDates () {
    this.dateRelative = this.fromNowPipe.transform(this.date())
    this.dateAbsolute = this.date().toLocaleString()
  }
}
