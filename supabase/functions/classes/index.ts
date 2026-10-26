// Supabase Edge Function: classes
// Schools plan. Teachers (active "school" subscription) create one class and get a join code; students join with the code.
// Projects shared to a class are visible only to that class's members. JWT verification ON.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const MAX_SHARED_PER_USER = 30;

function newCode(): string {
  // No 0/O/1/I so codes are easy to read out loud.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Please sign in again.' }, 401);
  const user = userData.user;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const action = String(body.action ?? '');
  const author = (user.email ?? 'student').split('@')[0].slice(0, 40);

  // Which class is this user in (as teacher or student)?
  const { data: teaching } = await admin.from('classes').select('id, name, join_code').eq('teacher_id', user.id).maybeSingle();
  let membership: { class_id: string } | null = null;
  if (!teaching) {
    const { data } = await admin.from('class_members').select('class_id').eq('user_id', user.id).maybeSingle();
    membership = data;
  }
  const classId = teaching?.id ?? membership?.class_id ?? null;

  const { data: sub } = await admin.from('subscriptions').select('status, current_period_end, plan, seats').eq('user_id', user.id).maybeSingle();
  const teacherActive =
    !!sub && sub.plan === 'school' && ['active', 'trialing'].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now());

  if (action === 'create') {
    if (teaching) return json({ error: 'You already have a class.' }, 400);
    if (membership) return json({ error: 'Leave your current class first.' }, 400);
    if (!teacherActive) return json({ error: 'Creating a class needs an active Schools plan.' }, 403);
    const name = clip(body.name, 80);
    if (!name) return json({ error: 'Give the class a name.' }, 400);
    for (let i = 0; i < 5; i++) {
      const { error } = await admin.from('classes').insert({ teacher_id: user.id, name, join_code: newCode() });
      if (!error) return json({ ok: true });
      if (!/duplicate|unique/i.test(error.message)) {
        console.error('create class failed', error);
        return json({ error: 'Could not create the class.' }, 500);
      }
    }
    return json({ error: 'Could not create a code. Try again.' }, 500);
  }

  if (action === 'join') {
    if (teaching) return json({ error: 'Teachers cannot join a class.' }, 400);
    if (membership) return json({ error: 'You are already in a class. Leave it first.' }, 400);
    const code = clip(body.code, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { data: cls } = await admin.from('classes').select('id, teacher_id, name').eq('join_code', code).maybeSingle();
    if (!cls) return json({ error: 'That class code was not found.' }, 404);
    const { data: ts } = await admin.from('subscriptions').select('status, current_period_end, plan, seats').eq('user_id', cls.teacher_id).maybeSingle();
    const ok = !!ts && ts.plan === 'school' && ['active', 'trialing'].includes(ts.status) &&
      (!ts.current_period_end || new Date(ts.current_period_end).getTime() > Date.now());
    if (!ok) return json({ error: 'This class is not active. Ask your teacher to check the Schools plan.' }, 403);
    const { count } = await admin.from('class_members').select('user_id', { count: 'exact', head: true }).eq('class_id', cls.id);
    if ((count ?? 0) >= (ts!.seats ?? 0)) return json({ error: 'This class is full. Ask your teacher to add seats.' }, 403);
    const { error } = await admin.from('class_members').insert({ user_id: user.id, class_id: cls.id });
    if (error) return json({ error: 'Could not join the class.' }, 500);
    return json({ ok: true });
  }

  if (!classId) return json({ ok: true, role: 'none' });

  if (action === 'leave') {
    if (teaching) return json({ error: 'Teachers cannot leave their class.' }, 400);
    await admin.from('class_members').delete().eq('user_id', user.id);
    return json({ ok: true });
  }

  if (action === 'me') {
    const { count } = await admin.from('class_members').select('user_id', { count: 'exact', head: true }).eq('class_id', classId);
    const out: Record<string, unknown> = {
      ok: true,
      role: teaching ? 'teacher' : 'student',
      className: teaching?.name ?? undefined,
      students: count ?? 0,
    };
    if (!teaching) {
      const { data: c } = await admin.from('classes').select('name').eq('id', classId).maybeSingle();
      out.className = c?.name;
    }
    if (teaching) {
      out.joinCode = teaching.join_code;
      out.seats = sub?.seats ?? 0;
      const { data: members } = await admin.from('class_members').select('user_id, joined_at').eq('class_id', classId).order('joined_at');
      const list = [];
      for (const m of members ?? []) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        list.push({ userId: m.user_id, name: u?.user?.email ?? 'student', joined: m.joined_at });
      }
      out.members = list;
    }
    return json(out);
  }

  if (action === 'gallery') {
    const { data } = await admin
      .from('class_projects')
      .select('id, user_id, author, title, board_name, fqbn, code, notes, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(100);
    return json({
      ok: true,
      projects: (data ?? []).map((p) => ({
        id: p.id, author: p.author, title: p.title, boardName: p.board_name, fqbn: p.fqbn,
        code: p.code, notes: p.notes, created: p.created_at, mine: p.user_id === user.id,
      })),
    });
  }

  if (action === 'share') {
    const title = clip(body.title, 80);
    const code = String(body.code ?? '').slice(0, 30000);
    if (!title || !code.trim()) return json({ error: 'Give the project a title and some code.' }, 400);
    const { count } = await admin.from('class_projects').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('user_id', user.id);
    if ((count ?? 0) >= MAX_SHARED_PER_USER) return json({ error: `You can share up to ${MAX_SHARED_PER_USER} projects. Remove one first.` }, 400);
    const { error } = await admin.from('class_projects').insert({
      class_id: classId, user_id: user.id, author: teaching ? `${author} (teacher)` : author, title,
      board_name: clip(body.boardName, 100) || null, fqbn: clip(body.fqbn, 100) || null, code, notes: clip(body.notes, 2000) || null,
    });
    if (error) return json({ error: 'Could not share the project.' }, 500);
    return json({ ok: true });
  }

  if (action === 'unshare') {
    const id = clip(body.id, 64);
    const q = admin.from('class_projects').delete().eq('id', id).eq('class_id', classId);
    const { error } = await (teaching ? q : q.eq('user_id', user.id));
    return error ? json({ error: 'Could not remove it.' }, 500) : json({ ok: true });
  }

  if (!teaching) return json({ error: 'Only the teacher can do that.' }, 403);

  if (action === 'remove') {
    await admin.from('class_members').delete().eq('class_id', classId).eq('user_id', clip(body.userId, 64));
    return json({ ok: true });
  }

  if (action === 'newcode') {
    const { error } = await admin.from('classes').update({ join_code: newCode() }).eq('id', classId);
    return error ? json({ error: 'Could not change the code.' }, 500) : json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
});
