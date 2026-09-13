// 네이버 아이디로 로그인 — Supabase Edge Function
//
// 네이버는 OAuth 2.0만 제공하고 OIDC id_token을 주지 않으므로 Supabase의 기본 제공자나
// 커스텀 OIDC로는 붙을 수 없다. 그래서 이 함수가 서버에서 직접 처리한다.
//
//   1) ?action=start     → 네이버 동의 화면으로 보낸다
//   2) ?action=callback  → 코드를 토큰으로 바꾸고 프로필을 받아 계정을 찾거나 만든 뒤
//                          Supabase 로그인 링크로 되돌린다
//
// 필요한 시크릿: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, SITE_URL
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const NAVER_AUTH = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_TOKEN = "https://nid.naver.com/oauth2.0/token";
const NAVER_ME = "https://openapi.naver.com/v1/nid/me";

const CLIENT_ID = Deno.env.get("NAVER_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("NAVER_CLIENT_SECRET")!;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://jodal.pro").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fnUrl(req: Request) {
  const u = new URL(req.url);
  return `${u.origin}${u.pathname}`;
}

function redirect(to: string, headers: HeadersInit = {}) {
  return new Response(null, { status: 302, headers: {
    Location: to, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers,
  } });
}

function fail(msg: string) {
  return redirect(`${SITE_URL}/login/?error=${encodeURIComponent(msg)}`, {
    "Set-Cookie": "nv_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "start";

    // ── 1) 네이버 동의 화면으로
    if (action === "start") {
      const state = crypto.randomUUID();
      const redirectUri = `${fnUrl(req)}?action=callback`;
      const to = `${NAVER_AUTH}?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      // state는 쿠키에 담아 콜백에서 맞춰 본다(교차 사이트 요청 위조 방지)
      return redirect(to, {
        "Set-Cookie": `nv_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      });
    }

    // ── 2) 콜백
    if (action !== "callback") return fail("unknown_action");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookie = req.headers.get("cookie") ?? "";
    const want = /(?:^|;\s*)nv_state=([^;]+)/.exec(cookie)?.[1];
    if (!code) return fail("no_code");
    if (!state || !want || state !== want) return fail("state_mismatch");

    // 코드 → 접근토큰
    const tokenRes = await fetch(NAVER_TOKEN, {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, code, state }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenRes.ok) return fail("token_failed");
    const token = await tokenRes.json();
    if (!token?.access_token) return fail("token_failed");

    // 접근토큰 → 프로필
    const meRes = await fetch(NAVER_ME, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!meRes.ok) return fail("profile_failed");
    const me = await meRes.json();
    if (me?.resultcode !== "00" || typeof me?.response?.id !== "string" ||
        !me.response.id || me.response.id.length > 128) return fail("profile_failed");

    const nv = me.response as {
      id: string; email?: string; name?: string; nickname?: string;
    };
    const naverId = String(nv.id);
    const name = String(nv.name ?? nv.nickname ?? "수험생").slice(0, 24);

    // ── 같은 네이버 계정이 이미 붙어 있는지 먼저 본다(이메일이 바뀌어도 같은 사람)
    let userId: string | null = null;
    const { data: link, error: lookupError } = await admin
      .from("social_links")
      .select("user_id")
      .eq("provider", "naver")
      .eq("provider_uid", naverId)
      .maybeSingle();
    if (lookupError) return fail("lookup_failed");
    if (link?.user_id) userId = link.user_id;

    // 제공자의 이메일 일치만으로 기존 계정에 연결하지 않는다.
    // 신규 계정은 제공자 ID에 묶인 내부 주소를 사용한다. 실제 이메일을 연결하려면
    // 별도의 로그인·이메일 확인 절차가 필요하다(이 함수에서는 수행하지 않는다).
    if (!userId) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(naverId));
      const providerKey = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const email = `${providerKey}@users.jodal.pro`;
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name,
          provider: "naver",
          naver_id: naverId,
        },
      });
      if (created.error || !created.data?.user?.id) return fail("create_failed");
      userId = created.data.user.id;
      const { error: insertError } = await admin.from("social_links").insert({
        provider: "naver", provider_uid: naverId, user_id: userId,
      });
      if (insertError) {
        // 연결 경쟁으로 기존 매핑을 덮어쓰지 않는다. 이번에 만든 미연결 계정만 정리한다.
        await admin.auth.admin.deleteUser(userId);
        return fail("link_failed");
      }
    }

    // 기존 연결의 userId를 다시 조회한다. 제공자 프로필의 이메일이 변경되더라도
    // 다른 이메일 계정으로 로그인 링크를 발급하면 안 된다.
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
    if (accountError || account?.user?.id !== userId || !account.user.email) return fail("account_failed");
    const { data: linkData, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: account.user.email,
      options: { redirectTo: `${SITE_URL}/me/` },
    });
    if (error || !linkData?.properties?.action_link) return fail("link_failed");

    return redirect(linkData.properties.action_link, {
      "Set-Cookie": "nv_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    });
  } catch {
    // 외부 응답/네트워크 오류가 서버 상세나 비밀값을 노출하지 않게 한다.
    return fail("login_failed");
  }
});
