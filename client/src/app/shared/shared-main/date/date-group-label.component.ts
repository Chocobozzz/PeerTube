import { ChangeDetectionStrategy, Component, HostBinding, input, OnInit } from '@angular/core'
import { isLastMonth, isLastWeek, isThisMonth, isToday, isYesterday } from '@peertube/peertube-core-utils'

export enum GroupDate {
  TODAY = 1,
  YESTERDAY = 2,
  THIS_WEEK = 3,
  THIS_MONTH = 4,
  LAST_MONTH = 5,
  OLDER = 6
}

export type GroupDateLabels = { [id in GroupDate]: string }

@Component({
  selector: 'my-date-group-label',
  templateUrl: 'date-group-label.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateGroupLabelComponent implements OnInit {
  store = input.required<Set<number>>()
  date = input.required<Date | string>()

  groupedDateLabels = input<GroupDateLabels>({
    [GroupDate.TODAY]: $localize`Today`,
    [GroupDate.YESTERDAY]: $localize`Yesterday`,
    [GroupDate.THIS_WEEK]: $localize`This week`,
    [GroupDate.THIS_MONTH]: $localize`This month`,
    [GroupDate.LAST_MONTH]: $localize`Last month`,
    [GroupDate.OLDER]: $localize`Older`
  })

  text: string

  @HostBinding('class.date-displayed')
  dateDisplayed = false

  ngOnInit (): void {
    const periods = [
      {
        value: GroupDate.TODAY,
        validator: (d: Date) => isToday(d)
      },
      {
        value: GroupDate.YESTERDAY,
        validator: (d: Date) => isYesterday(d)
      },
      {
        value: GroupDate.THIS_WEEK,
        validator: (d: Date) => isLastWeek(d)
      },
      {
        value: GroupDate.THIS_MONTH,
        validator: (d: Date) => isThisMonth(d)
      },
      {
        value: GroupDate.LAST_MONTH,
        validator: (d: Date) => isLastMonth(d)
      },
      {
        value: GroupDate.OLDER,
        validator: () => true
      }
    ]

    for (const period of periods) {
      if (period.validator(new Date(this.date()))) {
        if (this.store().has(period.value) === true) break

        // Only "Older" period, no need to display anything
        if (period.value === GroupDate.OLDER && this.store().size === 0) break

        this.store().add(period.value)
        this.text = this.groupedDateLabels()[period.value]
        this.dateDisplayed = true

        break
      }
    }
  }
}
