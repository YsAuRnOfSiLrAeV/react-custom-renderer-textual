import React, { useState } from "react";

export function CounterApp() {
  const [count, setCount] = useState(0);

  return React.createElement(
    "container",
    { id: "root" },
    React.createElement("text", {
      id: "text-1",
      text: `Count: ${count}`
    }),
    React.createElement("button", {
      id: "button-1",
      label: "Increment",
      onPress: () => {
        console.log("[node] button pressed");
        setCount((previous) => previous + 1);
      }
    })
  );
}