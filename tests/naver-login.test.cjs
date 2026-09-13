/* Exercise the actual Edge Function with fake provider/admin services. No network. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
const { webcrypto } = require("node:crypto");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");

const source = stripTypeScriptTypes(readFileSync(join(__dirname, "../supabase/functions/naver-login/index.ts"), "utf8")
  .replace(/^import\s+\{ createClient \}\s+from\s+"[^"]+";\s*$/m, ""));

function fixture(options = {}) {
  const calls = { create: [], insert: [], delete: [], get: [], generate: [], fetch: [] };
  const auth = {
    createUser: async (payload) => {
      calls.create.push(payload);
      return options.createError ? { error: { message: "exists" }, data: null }
        : { data: { user: { id: "new-user" } }, error: null };
    },
    deleteUser: async (id) => { calls.delete.push(id); return { error: null }; },
    getUserById: async (id) => {
      calls.get.push(id);
      return options.accountError ? { error: { message: "unavailable" }, data: null }
        : { data: { user: { id, email: options.accountEmail || "stored@example.com" } }, error: null };
    },
    generateLink: async (payload) => {
      calls.generate.push(payload);
      return { data: { properties: { action_link: "https://auth.example/verify?token=private" } }, error: null };
    },
    listUsers: async () => { throw new Error("must never find/link accounts by email"); },
  };
  const table = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({
      data: options.unlinked ? null : { user_id: "linked-user" },
      error: options.lookupError ? { message: "database unavailable" } : null,
    }),
    insert: async (payload) => {
      calls.insert.push(payload);
      return { error: options.insertError ? { message: "duplicate key" } : null };
    },
  };
  let handler;
  const env = { NAVER_CLIENT_ID: "client", NAVER_CLIENT_SECRET: "secret",
    SITE_URL: "https://jodal.pro", SUPABASE_URL: "https://auth.example", SUPABASE_SERVICE_ROLE_KEY: "service" };
  runInNewContext(source, {
    createClient: () => ({ auth: { admin: auth }, from: () => table }),
    Deno: { env: { get: (name) => env[name] }, serve: (fn) => { handler = fn; } },
    Request, Response, URL, URLSearchParams, TextEncoder, AbortSignal, crypto: webcrypto,
    fetch: async (url, init) => {
      calls.fetch.push({ url, init });
      if (options.networkError) throw new Error("secret provider details");
      if (url.includes("/token")) return Response.json({ access_token: "provider-token" });
      return Response.json({ resultcode: "00", response: {
        id: "provider-identity", email: "changed-or-untrusted@example.com", name: "Learner",
      } });
    },
  });
  const callback = (cookie = "nv_state=expected") => handler(new Request(
    "https://auth.example/functions/v1/naver-login?action=callback&code=code&state=expected",
    { headers: { cookie } },
  ));
  return { calls, callback, handler };
}

test("linked provider logs into the stored user even when provider email changes", async () => {
  const app = fixture();
  const result = await app.callback();
  assert.equal(result.status, 302);
  assert.deepEqual(app.calls.get, ["linked-user"]);
  assert.equal(app.calls.generate[0].email, "stored@example.com");
  assert.equal(app.calls.create.length, 0);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(app.calls.fetch[0].init.method, "POST");
  assert.ok(!app.calls.fetch[0].url.includes("secret"));
});

test("new provider identity gets an internal address without trusting provider email", async () => {
  const app = fixture({ unlinked: true });
  await app.callback();
  assert.match(app.calls.create[0].email, /^[a-f0-9]{64}@users\.jodal\.pro$/);
  assert.equal(app.calls.insert[0].user_id, "new-user");
  assert.deepEqual(app.calls.get, ["new-user"]);
});

test("failed account creation never links a preexisting email account", async () => {
  const app = fixture({ unlinked: true, createError: true });
  const response = await app.callback();
  assert.match(response.headers.get("location"), /error=create_failed$/);
  assert.equal(app.calls.insert.length, 0);
  assert.equal(app.calls.generate.length, 0);
});

test("database lookup failure fails closed without creating an identity", async () => {
  const app = fixture({ lookupError: true, unlinked: true });
  const response = await app.callback();
  assert.match(response.headers.get("location"), /error=lookup_failed$/);
  assert.equal(app.calls.create.length, 0);
  assert.equal(app.calls.generate.length, 0);
});

test("link collision does not overwrite mapping and removes only the new account", async () => {
  const app = fixture({ unlinked: true, insertError: true });
  const response = await app.callback();
  assert.match(response.headers.get("location"), /error=link_failed$/);
  assert.deepEqual(app.calls.delete, ["new-user"]);
  assert.equal(app.calls.generate.length, 0);
});

test("missing stored user cannot produce a login link", async () => {
  const app = fixture({ accountError: true });
  const response = await app.callback();
  assert.match(response.headers.get("location"), /error=account_failed$/);
  assert.equal(app.calls.generate.length, 0);
});

test("state cookies must have the exact cookie name", async () => {
  for (const cookie of ["", "nv_state=wrong", "other_nv_state=expected"]) {
    const app = fixture();
    const response = await app.callback(cookie);
    assert.match(response.headers.get("location"), /error=state_mismatch$/);
    assert.equal(app.calls.fetch.length, 0);
  }
});

test("provider errors return a generic failure and clear OAuth state", async () => {
  const app = fixture({ networkError: true });
  const response = await app.callback();
  assert.match(response.headers.get("location"), /error=login_failed$/);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(app.calls.generate.length, 0);
});

test("start sets a secure state cookie and unsupported methods are rejected", async () => {
  const app = fixture();
  const response = await app.handler(new Request("https://auth.example/functions/v1/naver-login"));
  assert.match(response.headers.get("location"), /^https:\/\/nid\.naver\.com\/oauth2\.0\/authorize\?/);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
  const post = await app.handler(new Request("https://auth.example/functions/v1/naver-login", { method: "POST" }));
  assert.equal(post.status, 405);
});
