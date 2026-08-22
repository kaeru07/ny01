"use client";

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * ルートレイアウトを含む描画に失敗した場合の最終フォールバック。
 * global-error は layout.tsx の外側で描画されるため html/body もここで定義する。
 */
export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          background: "#f8fafc",
          color: "#1f2937",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1rem",
            boxSizing: "border-box",
          }}
        >
          <section
            role="alert"
            style={{
              width: "100%",
              maxWidth: "40rem",
              padding: "1.5rem",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              background: "#fff",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <p aria-hidden="true" style={{ margin: 0, fontSize: "2.25rem" }}>
              🀄
            </p>
            <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.25rem" }}>
              アプリを表示できませんでした
            </h1>
            <p style={{ margin: "0.5rem 0 0", lineHeight: 1.7, color: "#4b5563" }}>
              入力内容は端末の外部へ送信されていません。もう一度お試しください。
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "44px",
                marginTop: "1.25rem",
                padding: "0.5rem 1.25rem",
                border: 0,
                borderRadius: "0.5rem",
                background: "#2563eb",
                color: "#fff",
                font: "inherit",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              もう一度試す
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
