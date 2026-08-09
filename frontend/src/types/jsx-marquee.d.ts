import 'react';

/**
 * The blades still use the legacy <marquee> element (rankings rows scroll long
 * usernames with it). React renders it fine; TypeScript just needs the type.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      marquee: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          behavior?: string;
          direction?: string;
          scrollAmount?: number;
        },
        HTMLElement
      >;
    }
  }
}
