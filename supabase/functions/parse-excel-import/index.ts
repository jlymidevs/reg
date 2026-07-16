import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as xlsx from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Upload unavailable' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'Upload unavailable' }, 401);
    const { data: isAdmin, error: roleError } = await client.rpc('is_admin');
    if (roleError || isAdmin !== true) return json({ error: 'Upload unavailable' }, 403);
    const form = await request.formData();
    const file = form.get('file');
    const fileType = form.get('fileType');
    if (!(file instanceof File) || fileType !== 'PCM') return json({ error: 'Upload unavailable' }, 400);
    if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) return json({ error: 'Upload unavailable' }, 400);
    const workbook = xlsx.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });
    if (rows.length === 0 || rows.length > 10000) return json({ error: 'Upload unavailable' }, 400);
    const { data: batch, error: batchError } = await client.from('import_batches').insert({ file_name: file.name, file_type: fileType, created_by: user.id }).select('id').single();
    if (batchError || !batch) return json({ error: 'Upload unavailable' }, 500);
    for (let offset = 0; offset < rows.length; offset += 500) {
      const insertRows = rows.slice(offset, offset + 500).map((row, index) => ({ batch_id: batch.id, row_number: offset + index + 2, raw_data_json: row, normalized_data_json: { email: String(row.Email ?? '').toLowerCase().trim(), phone: String(row.Phone ?? '').replace(/[^0-9+]/g, ''), first_name: String(row['First Name'] ?? row.FirstName ?? '').trim(), last_name: String(row['Last Name'] ?? row.LastName ?? '').trim(), date_of_birth: String(row.DOB ?? row['Date of Birth'] ?? '').trim(), journey_status: String(row.Category ?? row.Status ?? '').trim().toUpperCase() } }));
      const { error } = await client.from('import_rows').insert(insertRows);
      if (error) return json({ error: 'Upload unavailable' }, 500);
    }
    const { error: matchError } = await client.rpc('match_import_duplicates', { p_batch_id: batch.id });
    if (matchError) return json({ error: 'Upload unavailable' }, 500);
    return json({ batch_id: batch.id, row_count: rows.length });
  } catch {
    return json({ error: 'Upload unavailable' }, 500);
  }
});
