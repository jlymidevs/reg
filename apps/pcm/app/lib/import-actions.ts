'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import { requireAdminAccess } from './access';
import { buildFlashPath } from './flash';

type Result = { ok: true } | { ok: false; error: string };

export async function stageWorkbook(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) redirect(buildFlashPath('/dashboard/integration', 'error', 'Choose an Excel workbook first.'));
  if (!file.name.toLowerCase().endsWith('.xlsx')) redirect(buildFlashPath('/dashboard/integration', 'error', 'Only .xlsx workbooks are accepted.'));
  const body = new FormData();
  body.set('file', file);
  body.set('fileType', 'PCM');
  const { error } = await supabase.functions.invoke('parse-excel-import', { body });
  if (error) redirect(buildFlashPath('/dashboard/integration', 'error', 'Workbook could not be staged for review.'));
  revalidatePath('/dashboard/integration');
  redirect(buildFlashPath('/dashboard/integration', 'success', 'Workbook staged. Review errors and duplicates before applying.'));
}

async function runImportRpc(formData: FormData, rpc: string, success: string): Promise<Result> {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const batchId = String(formData.get('batchId') ?? '').trim();
  if (!batchId) return { ok: false, error: 'Import batch is required.' };
  const { error } = await supabase.rpc(rpc, { p_batch_id: batchId });
  if (error) return { ok: false, error: 'Import action could not be completed.' };
  revalidatePath('/dashboard/integration');
  return { ok: true };
}

export async function submitApplyImport(formData: FormData): Promise<void> {
  const result = await runImportRpc(formData, 'commit_import_batch', 'Import applied after approval.');
  redirect(buildFlashPath('/dashboard/integration', result.ok ? 'success' : 'error', result.ok ? 'Import applied after approval.' : result.error));
}

export async function submitRejectImport(formData: FormData): Promise<void> {
  const result = await runImportRpc(formData, 'rollback_import_batch', 'Import batch rejected.');
  redirect(buildFlashPath('/dashboard/integration', result.ok ? 'success' : 'error', result.ok ? 'Import batch rejected.' : result.error));
}
