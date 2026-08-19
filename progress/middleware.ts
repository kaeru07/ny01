import { NextRequest, NextResponse } from "next/server";

/**
 * progress の認証保護。
 * - ブラウザ: ログインフォーム + セッションCookie（iPhoneのパスワード自動入力対応）
 * - 自動連携(curl/factory): 従来どおり Basic 認証ヘッダ（-u user:pass）も通る
 * - BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が未設定なら素通り（ロックアウト防止）
 */

const COOKIE = "progress_auth";
const LOGIN_PATH = "/__login";

function expectedToken(user: string, pass: string): string {
  return btoa(unescape(encodeURIComponent(user + ":" + pass)));
}

function loginPage(nextPath: string, failed: boolean): string {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>progress — ログイン</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0e1116;
    font-family:-apple-system,"Hiragino Kaku Gothic ProN",system-ui,sans-serif;color:#dfe7f2;padding:24px}
  form{width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px}
  h1{font-size:20px;font-weight:900;letter-spacing:.06em;text-align:center;margin-bottom:6px}
  h1 small{display:block;font-size:11px;color:#66738a;font-weight:700;letter-spacing:.24em;margin-top:6px}
  label{font-size:11px;color:#8b98ad;font-weight:700;letter-spacing:.08em}
  input{width:100%;padding:14px;border-radius:12px;border:1.5px solid #2a3446;background:#161c28;color:#eaf2ff;
    font-size:16px;outline:none}
  input:focus{border-color:#4a90d9}
  button{margin-top:6px;padding:15px;border:none;border-radius:12px;background:#2f7fd6;color:#fff;
    font-size:16px;font-weight:900;letter-spacing:.1em;cursor:pointer}
  button:active{transform:translateY(2px)}
  .err{color:#ff7a8a;font-size:12.5px;font-weight:700;text-align:center}
</style></head><body>
<form method="POST" action="${LOGIN_PATH}">
  <h1>progress<small>SIGN IN</small></h1>
  ${failed ? '<div class="err">ユーザー名またはパスワードが違います</div>' : ""}
  <div><label for="u">ユーザー名</label>
  <input id="u" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" required></div>
  <div><label for="p">パスワード</label>
  <input id="p" name="password" type="password" autocomplete="current-password" required></div>
  <input type="hidden" name="next" value="${safeNext.replace(/"/g, "")}">
  <button type="submit">ログイン</button>
</form></body></html>`;
}

export async function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();
  const token = expectedToken(user, pass);

  // ログアウト（Cookie破棄 → ログイン画面へ）
  if (req.nextUrl.pathname === "/__logout") {
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  }

  // ログインフォームの送信
  if (req.nextUrl.pathname === LOGIN_PATH && req.method === "POST") {
    let u = "", p = "", next = "/";
    try {
      const fd = await req.formData();
      u = String(fd.get("username") ?? "");
      p = String(fd.get("password") ?? "");
      next = String(fd.get("next") ?? "/");
    } catch {
      // フォーム以外のボディは失敗扱い
    }
    // スマホ入力の揺れを吸収: 全角→半角(NFKC)・各種ダッシュ→ハイフン・前後空白除去
    const norm = (s: string) =>
      s.normalize("NFKC").replace(/[‐-―−ー－]/g, "-").trim();
    const okUser = norm(u).toLowerCase() === user.toLowerCase();
    const okPass = norm(p) === pass;
    if (okUser && okPass) {
      const dest = next.startsWith("/") ? next : "/";
      const res = NextResponse.redirect(new URL(dest, req.url), 303);
      res.cookies.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30日
      });
      return res;
    }
    return new NextResponse(loginPage(next, true), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // 自動連携: Basic 認証ヘッダ（curl -u / factoryトリガー）
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
        return NextResponse.next();
      }
    } catch {
      // 不正ヘッダは未認証として続行
    }
  }

  // ブラウザ: セッションCookie
  if (req.cookies.get(COOKIE)?.value === token) return NextResponse.next();

  // 未認証: APIはBasicチャレンジ(自動連携のエラーを明確に)、ページはログインフォーム
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="progress", charset="UTF-8"' },
    });
  }
  return new NextResponse(loginPage(req.nextUrl.pathname + req.nextUrl.search, false), {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // 静的アセットとファビコン以外の全経路を保護（UIページ + APIルート）
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
