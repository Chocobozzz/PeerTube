/* SystemJS module definition */
// eslint-disable-next-line no-var
declare var module: NodeModule

interface NodeModule {
  id: string
}

declare module 'markdown-it-emoji/lib/light.mjs'
