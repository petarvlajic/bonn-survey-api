/**
 * SHK echocardiography screening checklist (Nachgespräch) — matches clinical paper form.
 * Sent on POST /responses/:id/followup/complete as `echoScreening`.
 */

export const ECHO_MAIN_ROW_IDS = [
  'lv_function',
  'aortic_valve',
  'mitral_valve',
  'tricuspid_valve',
  'wall_motion',
] as const;

export type EchoMainRowId = (typeof ECHO_MAIN_ROW_IDS)[number];

export const ECHO_MAIN_ROWS: ReadonlyArray<{
  id: EchoMainRowId;
  categoryDe: string;
  unauffaelligDe: string;
  auffaelligDe: string;
}> = [
  {
    id: 'lv_function',
    categoryDe: 'LV-Funktion',
    unauffaelligDe: 'normale systolische Funktion',
    auffaelligDe: 'reduziert',
  },
  {
    id: 'aortic_valve',
    categoryDe: 'Aortenklappe',
    unauffaelligDe: 'keine relevante Stenose/Insuffizienz',
    auffaelligDe: 'pathologischer Befund',
  },
  {
    id: 'mitral_valve',
    categoryDe: 'Mitralklappe',
    unauffaelligDe: 'keine relevante Stenose/Insuffizienz',
    auffaelligDe: 'pathologischer Befund',
  },
  {
    id: 'tricuspid_valve',
    categoryDe: 'Trikuspidalklappe',
    unauffaelligDe: 'keine relevante Insuffizienz',
    auffaelligDe: 'pathologischer Befund',
  },
  {
    id: 'wall_motion',
    categoryDe: 'Wandbewegung',
    unauffaelligDe: 'normokinetisch',
    auffaelligDe: 'Wandbewegungsstörung',
  },
];

export const ECHO_OPTIONAL_IDS = ['pericardial_effusion', 'rv_enlargement', 'atrial_enlargement'] as const;

export type EchoOptionalId = (typeof ECHO_OPTIONAL_IDS)[number];

export const ECHO_OPTIONAL_ITEMS: ReadonlyArray<{ id: EchoOptionalId; labelDe: string }> = [
  { id: 'pericardial_effusion', labelDe: 'Perikarderguss' },
  { id: 'rv_enlargement', labelDe: 'RV-Vergrößerung' },
  { id: 'atrial_enlargement', labelDe: 'Vorhofvergrößerung' },
];

export type EchoOverall = 'unremarkable' | 'needs_followup';

export const ECHO_OVERALL: ReadonlyArray<{ id: EchoOverall; labelDe: string }> = [
  { id: 'unremarkable', labelDe: 'unauffälliges Echo-Screening' },
  { id: 'needs_followup', labelDe: 'kontrollbedürftiger/pathologischer Befund' },
];

export type EchoScreeningPayload = {
  main: Record<EchoMainRowId, 'unauffaellig' | 'auffaellig'>;
  optional: Record<EchoOptionalId, boolean>;
  overall: EchoOverall;
};

export function parseEchoScreeningFromBody(body: unknown):
  | { ok: true; value: EchoScreeningPayload }
  | { ok: false; error: string; code?: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body required', code: 'INVALID_BODY' };
  }
  const raw = (body as Record<string, unknown>).echoScreening;
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      error: 'echoScreening is required (SHK Echo checklist)',
      code: 'ECHO_SCREENING_REQUIRED',
    };
  }
  const o = raw as Record<string, unknown>;
  const mainRaw = o.main;
  const optRaw = o.optional;
  const overallRaw = o.overall;

  if (!mainRaw || typeof mainRaw !== 'object') {
    return { ok: false, error: 'echoScreening.main object required', code: 'ECHO_MAIN_REQUIRED' };
  }
  const main: Partial<Record<EchoMainRowId, 'unauffaellig' | 'auffaellig'>> = {};
  for (const id of ECHO_MAIN_ROW_IDS) {
    const v = (mainRaw as Record<string, unknown>)[id];
    if (v !== 'unauffaellig' && v !== 'auffaellig') {
      return {
        ok: false,
        error: `Für "${id}" muss genau eine Auswahl getroffen werden (unauffaellig oder auffaellig).`,
        code: 'ECHO_MAIN_INCOMPLETE',
      };
    }
    main[id] = v;
  }

  const optional: Record<EchoOptionalId, boolean> = {
    pericardial_effusion: false,
    rv_enlargement: false,
    atrial_enlargement: false,
  };
  if (optRaw && typeof optRaw === 'object') {
    for (const id of ECHO_OPTIONAL_IDS) {
      optional[id] = Boolean((optRaw as Record<string, unknown>)[id]);
    }
  }

  if (overallRaw !== 'unremarkable' && overallRaw !== 'needs_followup') {
    return {
      ok: false,
      error: 'echoScreening.overall muss unremarkable oder needs_followup sein.',
      code: 'ECHO_OVERALL_REQUIRED',
    };
  }

  return {
    ok: true,
    value: {
      main: main as Record<EchoMainRowId, 'unauffaellig' | 'auffaellig'>,
      optional,
      overall: overallRaw,
    },
  };
}

/** All main rows unremarkable, no optional flags, normal overall — for tests and fixtures. */
export function validEchoScreeningFixture(): EchoScreeningPayload {
  return {
    main: {
      lv_function: 'unauffaellig',
      aortic_valve: 'unauffaellig',
      mitral_valve: 'unauffaellig',
      tricuspid_valve: 'unauffaellig',
      wall_motion: 'unauffaellig',
    },
    optional: {
      pericardial_effusion: false,
      rv_enlargement: false,
      atrial_enlargement: false,
    },
    overall: 'unremarkable',
  };
}

/** Best-effort parse of persisted `shkFollowUp.echoScreening` (same shape as request body). */
export function parseEchoScreeningStored(raw: unknown): EchoScreeningPayload | null {
  const parsed = parseEchoScreeningFromBody({ echoScreening: raw });
  return parsed.ok ? parsed.value : null;
}

/** Human-readable lines for PDF export */
export function echoScreeningLinesForPdf(payload: EchoScreeningPayload): string[] {
  const lines: string[] = ['SHK Echo-Screening (Nachgespräch):'];
  for (const row of ECHO_MAIN_ROWS) {
    const v = payload.main[row.id];
    const side = v === 'unauffaellig' ? `unauffällig — ${row.unauffaelligDe}` : `auffällig — ${row.auffaelligDe}`;
    lines.push(`  • ${row.categoryDe}: ${side}`);
  }
  lines.push('  Optional (Kurzcheck):');
  for (const item of ECHO_OPTIONAL_ITEMS) {
    lines.push(`    - ${item.labelDe}: ${payload.optional[item.id] ? 'ja' : 'nein'}`);
  }
  const overallLabel = ECHO_OVERALL.find((x) => x.id === payload.overall)?.labelDe ?? payload.overall;
  lines.push(`  Gesamtbeurteilung: ${overallLabel}`);
  return lines;
}
