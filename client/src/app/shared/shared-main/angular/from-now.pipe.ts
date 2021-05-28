import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
@Pipe({ name: 'myFromNow' })
export class FromNowPipe implements PipeTransform {
  transform (arg: number | Date | string) {
    const argDate = new Date(arg)
    const seconds = Math.floor((Date.now() - argDate.getTime()) / 1000)

    let interval = Math.floor(seconds / 31536000)
    if (interval > 1) return $localize`${interval} years ago`
    if (interval === 1) return $localize`1 year ago`

    interval = Math.floor(seconds / 2419200)
    // 12 months = 360 days, but a year ~ 365 days
    // Display "1 year ago" rather than "12 months ago"
    if (interval >= 12) return $localize`1 year ago`
    if (interval > 1) return $localize`${interval} months ago`
    if (interval === 1) return $localize`1 month ago`

    interval = Math.floor(seconds / 604800)
    // 4 weeks ~ 28 days, but our month is 30 days
    // Display "1 month ago" rather than "4 weeks ago"
    if (interval >= 4) return $localize`1 month ago`
    if (interval > 1) return $localize`${interval} weeks ago`
    if (interval === 1) return $localize`1 week ago`

    interval = Math.floor(seconds / 86400)
    if (interval > 1) return $localize`${interval} days ago`
    if (interval === 1) return $localize`1 day ago`

    interval = Math.floor(seconds / 3600)
    if (interval > 1) return $localize`${interval} hours ago`
    if (interval === 1) return $localize`1 hour ago`

    interval = Math.floor(seconds / 60)
    if (interval >= 1) return $localize`${interval} min ago`

    return $localize`just now`
  }
}
