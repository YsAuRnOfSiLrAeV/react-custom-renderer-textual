import { useState } from "react";

export function CounterApp() {
  const [count, setCount] = useState(0);
  const [showText, setShowText] = useState(true);

  return (
    <textual-container id="root">
      {showText ? (
        <textual-text id="text-1" text={`Count: ${count}`} />
      ) : null}

      <textual-button
        id="button-1"
        label="Increment"
        onPress={() => {
          console.log("[node] button pressed");
          setCount((previous) => previous + 1);
        }}
      />

      <textual-button
        id="button-2"
        label={showText ? "Hide text" : "Show text"}
        onPress={() => {
          console.log("[node] toggle text");
          setShowText((previous) => !previous);
        }}
      />
    </textual-container>
  );
}