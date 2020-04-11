import { Pipe, PipeTransform } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { findIndex } from 'lodash-es'

// Thanks: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
@Pipe({ name: 'myFromNow' })
export class FromNowPipe implements PipeTransform {

  constructor (private i18n: I18n) { }

  transform (arg: number | Date | string) {
    const argDate = new Date(arg)
    const seconds = Math.floor((Date.now() - argDate.getTime()) / 1000)
    let intervals = [
      {
        unit: 31536000, // 1 year
        singular: (i: number) => this.i18n('{{i}} year', { i }),
        plural: (i: number) => this.i18n('{{i}} years', { i })
      },
      {
        unit: 2592000, // 1 month
        max: 11,
        singular: (i: number) => this.i18n('{{i}} month', { i }),
        plural: (i: number) => this.i18n('{{i}} months', { i })
      },
      {
        unit: 604800, // 1 week
        max: 3,
        singular: (i: number) => this.i18n('{{i}} week', { i }),
        plural: (i: number) => this.i18n('{{i}} weeks', { i })
      },
      {
        unit: 86400, // 1 day
        max: 6,
        singular: (i: number) => this.i18n('{{i}} day', { i }),
        plural: (i: number) => this.i18n('{{i}} days', { i })
      },
      {
        unit: 3600, // 1 hour
        max: 23,
        singular: (i: number) => this.i18n('{{i}} hour', { i }),
        plural: (i: number) => this.i18n('{{i}} hours', { i })
      },
      {
        unit: 60, // 1 min
        max: 59,
        singular: (i: number) => this.i18n('{{i}} min', { i }),
        plural: (i: number) => this.i18n('{{i}} min', { i })
      }
    ]
      .map(i => ({ ...i, interval: Math.floor(seconds / i.unit) })) // absolute interval
      .map((i, index, array) => ({ // interval relative to remainder
        ...i,
        interval: index === 0
          ? i.interval
          : Math.floor((seconds - array[index - 1].interval * array[index - 1].unit) / i.unit)
      }))
      .map(i => ({ // value, interval put in its translated text wrt max value
        ...i,
        value: (i.interval > 1
          ? i.plural
          : i.singular
        )(Math.min(i.max, i.interval)) // respect the max value
      }))

    // only keep the first two intervals with enough seconds to be considered
    const big_interval_index = findIndex(intervals, i => i.interval >= 1)
    intervals = intervals
      .slice(big_interval_index, big_interval_index + 2)
      .filter(i => i.interval >= 1)

    if (intervals.length === 0) {
      return this.i18n('just now')
    }

    return intervals.length == 1
      ? this.i18n('{{interval}} ago', { interval: intervals[0].value })
      : this.i18n('{{big_interval}} {{small_interval}} ago', { 
          big_interval: intervals[0].value,
          small_interval: intervals[1].value
        })
  }
}
