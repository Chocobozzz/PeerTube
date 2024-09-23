import { Component, Input, OnChanges } from '@angular/core'
import { FromNowPipe } from './from-now.pipe'

@Component({
  selector: 'my-date-toggle',
  templateUrl: './date-toggle.component.html',
  styleUrls: [ './date-toggle.component.scss' ],
  standalone: true
})
export class DateToggleComponent implements OnChanges {
  @Input() date: Date
  @Input() toggled = false

  dateRelative: string
  dateAbsolute: string

  constructor (private fromNowPipe: FromNowPipe) { }

  ngOnChanges () {
    this.updateDates()
  }

  toggle () {
    this.toggled = !this.toggled
  }

  getTitle () {
    const target = this.toggled
      ? this.dateRelative
      : this.dateAbsolute

    return $localize`Toggle this date format to "${target}"`
  }

  getContent () {
    return this.toggled
      ? this.dateAbsolute
      : this.dateRelative
  }

  private updateDates () {
    this.dateRelative = this.fromNowPipe.transform(this.date)
    this.dateAbsolute = this.date.toLocaleDateString()
  }
}
