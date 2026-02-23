export interface Env {
  DB: D1Database;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB
    .prepare("SELECT state_json FROM app_state WHERE id = 1")
    .first<{ state_json: string }>();

  if (!row) return json({ habits: [], completions: {} });

  try {
    return json(JSON.parse(row.state_json));
  } catch {
    return json({ habits: [], completions: {} });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json();

  await env.DB
    .prepare("UPDATE app_state SET state_json = ?, updated_at = datetime('now') WHERE id = 1")
    .bind(JSON.stringify(body))
    .run();

  return json({ ok: true });
};
