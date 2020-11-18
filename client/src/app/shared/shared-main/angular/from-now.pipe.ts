import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
@Pipe({ name: 'myFromNow' })
export class FromNowPipe implements PipeTransform {

  transform (arg: number | Date | string) {
    const argDate = new Date(arg)
    const seconds = Math.floor((Date.now() - argDate.getTime()) / 1000)

    let interval = Math.round(seconds / 31536000)
    if (interval > 1) return $localize`${interval} years ago`
    if (interval === 1) return $localize`${interval} year ago`

    interval = Math.round(seconds / 2592000)
    if (interval > 1) return $localize`${interval} months ago`
    if (interval === 1) return $localize`${interval} month ago`

    interval = Math.round(seconds / 604800)
    if (interval > 1) return $localize`${interval} weeks ago`
    if (interval === 1) return $localize`${interval} week ago`

    interval = Math.round(seconds / 86400)
    if (interval > 1) return $localize`${interval} days ago`
    if (interval === 1) return $localize`${interval} day ago`

    interval = Math.round(seconds / 3600)
    if (interval > 1) return $localize`${interval} hours ago`
    if (interval === 1) return $localize`${interval} hour ago`

    interval = Math.round(seconds / 60)
    if (interval >= 1) return $localize`${interval} min ago`

    return $localize`just now`
  }
}
