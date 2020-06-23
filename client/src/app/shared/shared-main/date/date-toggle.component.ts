import { DatePipe } from '@angular/common'
import { Component, Input, OnChanges, OnInit } from '@angular/core'
import { FromNowPipe } from '../angular/from-now.pipe'

@Component({
  selector: 'my-date-toggle',
  templateUrl: './date-toggle.component.html',
  styleUrls: [ './date-toggle.component.scss' ]
})
export class DateToggleComponent implements OnInit, OnChanges {
  @Input() date: Date
  @Input() toggled = false

  dateRelative: string
  dateAbsolute: string

  constructor (
    private datePipe: DatePipe,
    private fromNowPipe: FromNowPipe
  ) { }

  ngOnInit () {
    this.updateDates()
  }

  ngOnChanges () {
    this.updateDates()
  }

  toggle () {
    this.toggled = !this.toggled
  }

  getTitle () {
    return this.toggled ? this.dateRelative : this.dateAbsolute
  }

  getContent () {
    return this.toggled ? this.dateAbsolute : this.dateRelative
  }

  private updateDates () {
    this.dateRelative = this.fromNowPipe.transform(this.date)
    this.dateAbsolute = this.datePipe.transform(this.date, 'long')
  }
}
