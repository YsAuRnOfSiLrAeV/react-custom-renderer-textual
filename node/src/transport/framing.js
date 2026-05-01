export const sendFramingMessage = (socket, message) => {
  socket.write(JSON.stringify(message) + "\n");
};

/*
TCP gives us a byte stream, not complete messages.
One JSON message may arrive in several chunks, and several messages may arrive in one chunk.
We use one JSON object per line.
'\n' is our message boundary, so we keep incoming text in a buffer
until at least one full JSON line is available.
*/
export const createFramingParser = (onMessage) => {
  let buffer = "";

  return (chunk) => {
    buffer += chunk;

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const rawJsonLine = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (rawJsonLine.length > 0) {
        try {
          const framedMessage = JSON.parse(rawJsonLine);
          onMessage(framedMessage);
        } catch (error) {
          console.error("Failed to process JSON line:", rawJsonLine);
          console.error(error);
        }
      }

      newlineIndex = buffer.indexOf("\n");
    }
  };
};