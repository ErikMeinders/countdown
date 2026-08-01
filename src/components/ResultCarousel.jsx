import { useEffect, useRef, useState } from "react";
import { REDUCED } from "../constants.js";
import { useTheme } from "../theme-context.jsx";
import { ResultCard } from "./ResultCard.jsx";

// A horizontal, swipeable carousel of solution cards: one main card with ~12%
// of the neighbours peeking, native scroll-snap, and pagination dots. Cards
// reveal one after another; reduced-motion shows them all at once. Shared by
// single-player and multiplayer results.
//
// `resetKey` identifies the round, so the reveal only restarts on a genuinely
// new set of results — not on every incidental re-render.
export function ResultCarousel({ cards, target, resetKey }) {
  const T = useTheme();
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(REDUCED ? cards.length : 0);

  useEffect(() => {
    if (REDUCED) {
      setRevealed(cards.length);
      return undefined;
    }
    setRevealed(0);
    const timers = cards.map((_, i) => setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 350 + i * 550));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, cards.length]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / (el.scrollWidth / cards.length));
    setActive(Math.max(0, Math.min(cards.length - 1, idx)));
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          padding: "4px 12px",
          margin: "0 -12px",
          scrollbarWidth: "none",
        }}
      >
        {cards.map((card, i) => (
          <div
            key={card.key}
            style={{
              flex: "0 0 78%",
              scrollSnapAlign: "center",
              transition: REDUCED ? "none" : "opacity 0.4s ease, transform 0.4s ease",
              opacity: i < revealed ? 1 : 0.35,
              transform: i < revealed ? "none" : "scale(0.96)",
            }}
            aria-hidden={i >= revealed}
          >
            {i < revealed ? (
              <ResultCard card={card} target={target} />
            ) : (
              <div
                style={{
                  minHeight: 220,
                  borderRadius: T.r.lg,
                  border: `1px dashed ${T.hair}`,
                  background: T.surfaceLo,
                  display: "grid",
                  placeItems: "center",
                  color: T.dim,
                  fontFamily: T.mono,
                  fontSize: 26,
                }}
              >
                ?
              </div>
            )}
          </div>
        ))}
      </div>

      {cards.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 12 }}>
          {cards.map((card, i) => (
            <span
              key={card.key}
              style={{
                width: i === active ? 18 : 7,
                height: 7,
                borderRadius: 999,
                background: i === active ? T.cyan : T.hairStrong,
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
