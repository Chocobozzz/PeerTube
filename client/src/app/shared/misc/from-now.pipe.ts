import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
@Pipe({ name: 'myFromNow' })
export class FromNowPipe implements PipeTransform {

  transform (value: number) {
    const seconds = Math.floor((Date.now() - value) / 1000)

    let interval = Math.floor(seconds / 31536000)
    if (interval > 1) {
      return interval + ' years ago'
    }

    interval = Math.floor(seconds / 2592000)
    if (interval > 1) return interval + ' months ago'
    if (interval === 1) return interval + ' month ago'

    interval = Math.floor(seconds / 604800)
    if (interval > 1) return interval + ' weeks ago'
    if (interval === 1) return interval + ' week ago'

    interval = Math.floor(seconds / 86400)
    if (interval > 1) return interval + ' days ago'
    if (interval === 1) return interval + ' day ago'

    interval = Math.floor(seconds / 3600)
    if (interval > 1) return interval + ' hours ago'
    if (interval === 1) return interval + ' hour ago'

    interval = Math.floor(seconds / 60)
    if (interval >= 1) return interval + ' min ago'

    return Math.floor(seconds) + ' sec ago'
  }
}
