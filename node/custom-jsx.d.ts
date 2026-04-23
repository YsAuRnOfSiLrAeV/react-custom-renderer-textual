import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "textual-container": {
        id?: string;
        children?: React.ReactNode;
      };

      "textual-text": {
        id?: string;
        text: string;
      };

      "textual-button": {
        id?: string;
        label: string;
        onPress?: () => void;
        onClick?: () => void;
      };
    }
  }
}