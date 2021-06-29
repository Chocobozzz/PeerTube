import { Directive, EventEmitter, HostListener, Output } from '@angular/core'

@Directive({
  selector: '[timestampRouteTransformer]'
})
export class TimestampRouteTransformerDirective {
  @Output() timestampClicked = new EventEmitter<number>()

  @HostListener('click', ['$event'])
  public onClick ($event: Event) {
    const target = $event.target as HTMLLinkElement

    if (target.hasAttribute('href') !== true) return

    const ngxLink = document.createElement('a')
    ngxLink.href = target.getAttribute('href')

    // we only care about reflective links
    if (ngxLink.host !== window.location.host) return

    const ngxLinkParams = new URLSearchParams(ngxLink.search)
    if (ngxLinkParams.has('start') !== true) return

    const separators = ['h', 'm', 's']
    const start = ngxLinkParams
      .get('start')
      .match(new RegExp('(\\d{1,9}[' + separators.join('') + '])','g')) // match digits before any given separator
      .map(t => {
        if (t.includes('h')) return parseInt(t, 10) * 3600
        if (t.includes('m')) return parseInt(t, 10) * 60
        return parseInt(t, 10)
      })
      .reduce((acc, t) => acc + t)

    this.timestampClicked.emit(start)

    $event.preventDefault()
  }
}
