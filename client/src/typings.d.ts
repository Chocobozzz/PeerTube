/* SystemJS module definition */
declare var module: NodeModule

interface NodeModule {
  id: string
}

/* ResizeObserver API definition */
declare global { /* tslint:disable */
  interface Window { ResizeObserver: any }
}

window.ResizeObserver = window.ResizeObserver || {} /* tslint:disable */
