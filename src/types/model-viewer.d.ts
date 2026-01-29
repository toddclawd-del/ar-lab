/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
        ar?: boolean
        'ar-modes'?: string
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'shadow-intensity'?: string
        'environment-image'?: string
        poster?: string
        loading?: 'auto' | 'lazy' | 'eager'
        reveal?: 'auto' | 'manual'
        [key: string]: any
      },
      HTMLElement
    >
  }
}

declare module '@google/model-viewer' {
  export default class ModelViewerElement extends HTMLElement {
    src: string
    alt: string
    ar: boolean
  }
}
