import { useCallback, useRef, useState } from "react";

// A polite screen-reader live region plus a hook to push messages into it, for
// events a sighted player sees but a screen-reader user would otherwise miss:
// a player joining, the round starting, an answer being accepted, the result.
const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const last = useRef("");
  const announce = useCallback((text) => {
    if (!text || text === last.current) return;
    last.current = text;
    setMessage(text);
  }, []);
  const node = (
    <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
      {message}
    </div>
  );
  return { announce, node };
}
