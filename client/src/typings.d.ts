/* SystemJS module definition */
declare var module: NodeModule

interface NodeModule {
  id: string
}

/* ResizeObserver API definition */
interface Window {
  ResizeObserver: any
}
