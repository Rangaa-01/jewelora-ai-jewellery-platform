"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#faf7f2",
          color: "#1b1a17",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <p
            style={{
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 12,
              color: "#8a6a2b",
              fontWeight: 600,
            }}
          >
            Jewelora
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 500, margin: "0.5rem 0 1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#6f6a60" }}>We hit an unexpected problem. Please try again.</p>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "0 24px",
              background: "#c6a15b",
              border: "1px solid #8a6a2b",
              borderRadius: 4,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 12, color: "#9a948a" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
