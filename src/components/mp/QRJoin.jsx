import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "../../theme-context.jsx";

// The QR code encodes a normal HTTPS join link (never the wss:// URL). Rendered
// on a light plaque so a dark-mode phone camera still reads it. Bundled, so it
// works with no network — important, since the lobby may be shown offline until
// the first connection.
export function QRJoin({ url, size = 180 }) {
  const T = useTheme();
  return (
    <div
      style={{
        padding: 14,
        borderRadius: T.r.lg,
        background: "#ffffff",
        display: "inline-flex",
        boxShadow: `0 2px 12px rgba(0,0,0,0.25)`,
      }}
    >
      <QRCodeSVG value={url} size={size} level="M" marginSize={0} />
    </div>
  );
}
