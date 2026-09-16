// Supabase Edge Function — recebe o aviso de nova mensagem do motorista
// (disparado pelo trigger notify_driver_message_to_passenger) e envia o
// push FCM de verdade pro(s) token(s) do passageiro.
//
// Porta a mesma lógica de src/lib/notifications/fcm.server.ts do Drivon
// (assinatura OAuth2 via WebCrypto, API HTTP v1 do FCM) — sem SDK do
// Firebase Admin, só fetch + crypto.subtle, compatível com o runtime Deno
// das Edge Functions.
//
// Variáveis de ambiente (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL               — já vem pronta por padrão
//   SUPABASE_SERVICE_ROLE_KEY  — já vem pronta por padrão
//   SUPABASE_ANON_KEY          — já vem pronta por padrão (usada só pra
//                                 conferir o header apikey do gatilho)
//   FIREBASE_SERVICE_ACCOUNT   — cole aqui o JSON da service account
//                                 (Firebase Console → Configurações do
//                                 projeto → Contas de serviço → Gerar nova
//                                 chave privada). SEGREDO — nunca comitar.
//
// Publicar com "Enforce JWT Verification" DESLIGADO (o endpoint faz sua
// própria checagem de apikey abaixo, igual o endpoint do motorista faz).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPECTED_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) {
    console.error("[fcm] oauth", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function sendFcm(sa: ServiceAccount, fcmToken: string, title: string, body: string, url: string, tag: string) {
  const token = await accessToken(sa);
  if (!token) return { ok: false, status: 0, error: "oauth falhou" };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: { url, title, body, tag },
        android: {
          priority: "HIGH",
          notification: { tag, channel_id: "drivon_passageiro_default" },
        },
      },
    }),
  });
  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text().catch(() => "");
  const invalidToken = res.status === 404 || (res.status === 400 && /registration-token|INVALID_ARGUMENT/i.test(text));
  return { ok: false, status: res.status, invalidToken, error: text.slice(0, 400) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const apiKey = req.headers.get("apikey") ?? "";
  if (!EXPECTED_KEY || apiKey !== EXPECTED_KEY) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sa = serviceAccount();
  if (!sa) return Response.json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT ausente" }, { status: 500 });

  let payload: { passenger_id?: string; body?: string; link_id?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "json inválido" }, { status: 400 });
  }
  const { passenger_id, body, link_id } = payload;
  if (!passenger_id || !body || !link_id) {
    return Response.json({ ok: false, error: "campos faltando" }, { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: tokens } = await supabaseAdmin
    .from("passenger_push_tokens")
    .select("token")
    .eq("passenger_id", passenger_id);

  if (!tokens || tokens.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "sem token registrado" });
  }

  let sent = 0;
  for (const row of tokens) {
    const result = await sendFcm(
      sa,
      row.token as string,
      "Nova mensagem",
      body.slice(0, 180),
      `/chat/${link_id}`,
      `chat:${link_id}`,
    );
    if (result.ok) sent += 1;
    else if (result.invalidToken) {
      await supabaseAdmin.from("passenger_push_tokens").delete().eq("token", row.token as string);
    } else {
      console.error("[notify-passenger] fcm falhou", result.status, result.error);
    }
  }

  return Response.json({ ok: true, sent });
});
