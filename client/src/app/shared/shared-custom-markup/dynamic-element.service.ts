import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EmbeddedViewRef,
  inject,
  Injectable,
  Injector,
  InputSignal,
  OnChanges,
  SimpleChanges,
  Type
} from '@angular/core'
import { outputToObservable } from '@angular/core/rxjs-interop'
import { firstValueFrom } from 'rxjs'
import { CustomMarkupComponent } from './peertube-custom-tags/shared'

type ComponentInputs<T> = {
  [P in keyof T]: T[P] extends InputSignal<infer A> ? A : never
}

@Injectable()
export class DynamicElementService {
  private injector = inject(Injector)
  private applicationRef = inject(ApplicationRef)

  createElement<T extends CustomMarkupComponent> (ofComponent: Type<T>) {
    const div = document.createElement('div')

    const component = createComponent(ofComponent, {
      environmentInjector: this.applicationRef.injector,
      elementInjector: this.injector,
      hostElement: div
    })

    const loadedPromise = component.instance.loaded
      ? firstValueFrom(outputToObservable(component.instance.loaded))
      : undefined

    return { component, loadedPromise }
  }

  injectElement<T> (wrapper: HTMLElement, componentRef: ComponentRef<T>) {
    const hostView = componentRef.hostView as EmbeddedViewRef<any>

    this.applicationRef.attachView(hostView)
    wrapper.appendChild(hostView.rootNodes[0])
  }

  setModel<T> (componentRef: ComponentRef<T>, attributes: Partial<ComponentInputs<T>>) {
    const changes: SimpleChanges = {}

    for (const [ key, value ] of Object.entries(attributes)) {
      componentRef.setInput(key, value)
    }

    const component = componentRef.instance
    if (typeof (component as unknown as OnChanges).ngOnChanges === 'function') {
      ;(component as unknown as OnChanges).ngOnChanges(changes)
    }

    componentRef.changeDetectorRef.detectChanges()
  }
}
