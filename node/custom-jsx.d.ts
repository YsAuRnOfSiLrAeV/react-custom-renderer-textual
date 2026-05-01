import "react";

type WithKey = React.Attributes;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "textual-container": WithKey & {
        id?: string;
        children?: React.ReactNode;
        style?: { flexDirection?: "row" | "column"; gap?: number };
      };

      "textual-text": WithKey & {
        id?: string;
        text?: string;
      };

      "textual-button": WithKey & {
        id?: string;
        label?: string;
        onPress?: () => void;
      };

      "textual-input": WithKey & {
        id?: string;
        value?: string;
        placeholder?: string;
        onChange?: (payload: { value: string }) => void;
        onSubmit?: (payload: { value: string }) => void;
      };
    }
  }
}