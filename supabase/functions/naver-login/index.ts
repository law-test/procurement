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
  return new Response(null, { status: 302, headers: { Location: to, ...headers } });
}

function fail(msg: string) {
  return redirect(`${SITE_URL}/login/?error=${encodeURIComponent(msg)}`);
}

Deno.serve(async (req) => {
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
  const want = /nv_state=([^;]+)/.exec(cookie)?.[1];
  if (!code) return fail("no_code");
  if (!state || !want || state !== want) return fail("state_mismatch");

  // 코드 → 접근토큰
  const tokenRes = await fetch(
    `${NAVER_TOKEN}?grant_type=authorization_code&client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(CLIENT_SECRET)}&code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state)}`,
  );
  const token = await tokenRes.json();
  if (!token?.access_token) return fail("token_failed");

  // 접근토큰 → 프로필
  const meRes = await fetch(NAVER_ME, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = await meRes.json();
  if (me?.resultcode !== "00" || !me?.response?.id) return fail("profile_failed");

  const nv = me.response as {
    id: string; email?: string; name?: string; nickname?: string;
  };
  const naverId = String(nv.id);
  const name = (nv.name ?? nv.nickname ?? "수험생").slice(0, 24);

  // 네이버는 이메일 제공 동의가 선택일 수 있다. 없으면 내부용 주소를 만든다.
  // 이 주소로는 메일이 가지 않으므로, 나중에 본인이 실제 주소를 등록할 수 있게 화면을 둔다.
  const email = (nv.email ?? `naver_${naverId}@users.jodal.pro`).toLowerCase();
  const hasRealEmail = Boolean(nv.email);

  // ── 같은 네이버 계정이 이미 붙어 있는지 먼저 본다(이메일이 바뀌어도 같은 사람)
  let userId: string | null = null;
  const { data: link } = await admin
    .from("social_links")
    .select("user_id")
    .eq("provider", "naver")
    .eq("provider_uid", naverId)
    .maybeSingle();
  if (link?.user_id) userId = link.user_id;

  // 계정이 없으면 만든다. 이미 같은 이메일의 계정이 있으면 그 계정에 붙인다.
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name,
        provider: "naver",
        naver_id: naverId,
        email_verified_by_naver: hasRealEmail,
      },
    });
    if (created.data?.user?.id) {
      userId = created.data.user.id;
    } else {
      // 이미 있는 이메일이면 목록에서 찾아 붙인다
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
      if (!userId) return fail("create_failed");
    }
    await admin.from("social_links").upsert({
      provider: "naver", provider_uid: naverId, user_id: userId,
    }, { onConflict: "provider,provider_uid" });
  }

  // ── 로그인 링크를 만들어 브라우저를 되돌린다
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/me/` },
  });
  if (error || !linkData?.properties?.action_link) return fail("link_failed");

  return redirect(linkData.properties.action_link, {
    "Set-Cookie": "nv_state=; Path=/; Max-Age=0",
  });
});
