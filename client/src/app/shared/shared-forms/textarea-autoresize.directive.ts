// Thanks: https://github.com/evseevdev/ngx-textarea-autosize
import { AfterViewInit, Directive, ElementRef, HostBinding, HostListener } from '@angular/core'

@Directive({
  selector: 'textarea[myAutoResize]'
})
export class TextareaAutoResizeDirective implements AfterViewInit {
  @HostBinding('attr.rows') rows = '1'
  @HostBinding('style.overflow') overflow = 'hidden'

  constructor (private elem: ElementRef) { }

  public ngAfterViewInit () {
    this.resize()
  }

  @HostListener('input')
  resize () {
    const textarea = this.elem.nativeElement as HTMLTextAreaElement
    // Reset textarea height to auto that correctly calculate the new height
    textarea.style.height = 'auto'
    // Set new height
    textarea.style.height = `${textarea.scrollHeight}px`
  }
}
