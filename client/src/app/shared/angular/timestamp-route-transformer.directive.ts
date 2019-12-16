import { Directive, ElementRef, HostListener, Output, EventEmitter } from '@angular/core'
import { Router } from '@angular/router'

type ElementEvent = Omit<Event, 'target'> & {
  target: HTMLInputElement
}

@Directive({
  selector: '[timestampRouteTransformer]'
})
export class TimestampRouteTransformerDirective {
  @Output() timestampClicked = new EventEmitter<number>()

  constructor (private el: ElementRef, private router: Router) { }

  @HostListener('click', ['$event'])
  public onClick ($event: ElementEvent) {
    if ($event.target.hasAttribute('href')) {
      const ngxLink = document.createElement('a')
      ngxLink.href = $event.target.getAttribute('href')

      // we only care about reflective links
      if (ngxLink.host !== window.location.host) return

      const ngxLinkParams = new URLSearchParams(ngxLink.search)
      if (ngxLinkParams.has('start')) {
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
      }

      $event.preventDefault()
    }

    return
  }
}
