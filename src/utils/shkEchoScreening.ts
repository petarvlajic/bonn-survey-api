/**
 * SHK echocardiography screening (Nachgespräch) — Herz Check Bonn form 260601.
 * Sent on POST /responses/:id/followup/complete as `echoScreening`.
 */

export const ECHO_MAIN_ROW_IDS = [
  'lv_function',
  'wall_motion',
  'aortic_valve',
  'mitral_valve',
  'tricuspid_valve',
  'ascending_aorta',
] as const;

export type EchoMainRowId = (typeof ECHO_MAIN_ROW_IDS)[number];

export type EchoBinaryValue = 'unauffaellig' | 'auffaellig';
export type EchoValveValue = 'unauffaellig' | 'stenose' | 'insuffizienz' | 'auffaellig';
export type EchoTricuspidValue = 'unauffaellig' | 'insuffizienz' | 'auffaellig';
export type EchoAortaValue = 'unauffaellig' | 'dilatiert';

export type EchoMainValues = {
  lv_function: EchoBinaryValue;
  wall_motion: EchoBinaryValue;
  aortic_valve: EchoValveValue;
  mitral_valve: EchoValveValue;
  tricuspid_valve: EchoTricuspidValue;
  ascending_aorta: EchoAortaValue;
};

export const ECHO_BINARY_LABELS: Record<
  'lv_function' | 'wall_motion',
  { unauffaellig: string; auffaellig: string }
> = {
  lv_function: {
    unauffaellig: 'normale systolische Funktion',
    auffaellig: 'reduziert',
  },
  wall_motion: {
    unauffaellig: 'normokinetisch',
    auffaellig: 'Wandbewegungsstörung',
  },
};

export const ECHO_VALVE_OPTIONS: ReadonlyArray<{ value: EchoValveValue; labelDe: string }> = [
  { value: 'unauffaellig', labelDe: 'unauffällig — keine relevante Stenose/Insuffizienz' },
  { value: 'stenose', labelDe: 'auffällig — V.a. Stenose' },
  { value: 'insuffizienz', labelDe: 'auffällig — V.a. Insuffizienz' },
];

export const ECHO_TRICUSPID_OPTIONS: ReadonlyArray<{ value: EchoTricuspidValue; labelDe: string }> = [
  { value: 'unauffaellig', labelDe: 'unauffällig — keine relevante Insuffizienz' },
  { value: 'insuffizienz', labelDe: 'auffällig — V.a. Insuffizienz' },
];

export const ECHO_AORTA_OPTIONS: ReadonlyArray<{ value: EchoAortaValue; labelDe: string }> = [
  { value: 'unauffaellig', labelDe: 'unauffällig' },
  { value: 'dilatiert', labelDe: 'dilatiert/ektatisch' },
];

/** @deprecated Use row-specific configs; kept for PDF row titles. */
export const ECHO_MAIN_ROWS: ReadonlyArray<{
  id: EchoMainRowId;
  categoryDe: string;
  unauffaelligDe: string;
  auffaelligDe: string;
}> = [
  {
    id: 'lv_function',
    categoryDe: 'LV-Funktion',
    unauffaelligDe: ECHO_BINARY_LABELS.lv_function.unauffaellig,
    auffaelligDe: ECHO_BINARY_LABELS.lv_function.auffaellig,
  },
  {
    id: 'wall_motion',
    categoryDe: 'Wandbewegung',
    unauffaelligDe: ECHO_BINARY_LABELS.wall_motion.unauffaellig,
    auffaelligDe: ECHO_BINARY_LABELS.wall_motion.auffaellig,
  },
  {
    id: 'aortic_valve',
    categoryDe: 'Aortenklappe',
    unauffaelligDe: 'keine relevante Stenose/Insuffizienz',
    auffaelligDe: 'V.a. Stenose / Insuffizienz',
  },
  {
    id: 'mitral_valve',
    categoryDe: 'Mitralklappe',
    unauffaelligDe: 'keine relevante Stenose/Insuffizienz',
    auffaelligDe: 'V.a. Stenose / Insuffizienz',
  },
  {
    id: 'tricuspid_valve',
    categoryDe: 'Trikuspidalklappe',
    unauffaelligDe: 'keine relevante Insuffizienz',
    auffaelligDe: 'V.a. Insuffizienz',
  },
  {
    id: 'ascending_aorta',
    categoryDe: 'Aorta ascendens',
    unauffaelligDe: 'unauffällig',
    auffaelligDe: 'dilatiert/ektatisch',
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
  main: EchoMainValues;
  optional: Record<EchoOptionalId, boolean>;
  comment?: string;
  overall: EchoOverall;
};

const BINARY_IDS = new Set<EchoMainRowId>(['lv_function', 'wall_motion']);
const VALVE_IDS = new Set<EchoMainRowId>(['aortic_valve', 'mitral_valve']);

function isValidBinary(v: unknown): v is EchoBinaryValue {
  return v === 'unauffaellig' || v === 'auffaellig';
}

function isValidValve(v: unknown): v is EchoValveValue {
  return v === 'unauffaellig' || v === 'stenose' || v === 'insuffizienz' || v === 'auffaellig';
}

function isValidTricuspid(v: unknown): v is EchoTricuspidValue {
  return v === 'unauffaellig' || v === 'insuffizienz' || v === 'auffaellig';
}

function isValidAorta(v: unknown): v is EchoAortaValue {
  return v === 'unauffaellig' || v === 'dilatiert';
}

function validateMainRow(id: EchoMainRowId, v: unknown): v is EchoMainValues[typeof id] {
  if (BINARY_IDS.has(id)) return isValidBinary(v);
  if (VALVE_IDS.has(id)) return isValidValve(v);
  if (id === 'tricuspid_valve') return isValidTricuspid(v);
  if (id === 'ascending_aorta') return isValidAorta(v);
  return false;
}

function normalizeStoredMain(mainRaw: Record<string, unknown>): Record<string, unknown> {
  const main = { ...mainRaw };
  if (!main.ascending_aorta) {
    main.ascending_aorta = 'unauffaellig';
  }
  return main;
}

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
  const commentRaw = o.comment;

  if (!mainRaw || typeof mainRaw !== 'object') {
    return { ok: false, error: 'echoScreening.main object required', code: 'ECHO_MAIN_REQUIRED' };
  }

  const main = {} as EchoMainValues;
  for (const id of ECHO_MAIN_ROW_IDS) {
    const v = (mainRaw as Record<string, unknown>)[id];
    if (!validateMainRow(id, v)) {
      return {
        ok: false,
        error: `Für "${id}" muss genau eine gültige Auswahl getroffen werden.`,
        code: 'ECHO_MAIN_INCOMPLETE',
      };
    }
    (main as Record<EchoMainRowId, string>)[id] = v as string;
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

  const comment =
    typeof commentRaw === 'string' && commentRaw.trim() ? commentRaw.trim() : undefined;

  return {
    ok: true,
    value: {
      main: main,
      optional,
      comment,
      overall: overallRaw,
    },
  };
}

/** All main rows unremarkable — for tests and fixtures. */
export function validEchoScreeningFixture(): EchoScreeningPayload {
  return {
    main: {
      lv_function: 'unauffaellig',
      wall_motion: 'unauffaellig',
      aortic_valve: 'unauffaellig',
      mitral_valve: 'unauffaellig',
      tricuspid_valve: 'unauffaellig',
      ascending_aorta: 'unauffaellig',
    },
    optional: {
      pericardial_effusion: false,
      rv_enlargement: false,
      atrial_enlargement: false,
    },
    overall: 'unremarkable',
  };
}

function formatMainValueForPdf(id: EchoMainRowId, v: string): string {
  if (BINARY_IDS.has(id)) {
    const labels = ECHO_BINARY_LABELS[id as 'lv_function' | 'wall_motion'];
    return v === 'unauffaellig'
      ? `unauffällig — ${labels.unauffaellig}`
      : `auffällig — ${labels.auffaellig}`;
  }
  if (VALVE_IDS.has(id)) {
    const opt = ECHO_VALVE_OPTIONS.find((x) => x.value === v);
    if (opt) return opt.labelDe;
    if (v === 'auffaellig') return 'auffällig (legacy)';
    return v;
  }
  if (id === 'tricuspid_valve') {
    const opt = ECHO_TRICUSPID_OPTIONS.find((x) => x.value === v);
    return opt?.labelDe ?? v;
  }
  if (id === 'ascending_aorta') {
    const opt = ECHO_AORTA_OPTIONS.find((x) => x.value === v);
    return opt?.labelDe ?? v;
  }
  return v;
}

/** Best-effort parse of persisted `shkFollowUp.echoScreening`. */
export function parseEchoScreeningStored(raw: unknown): EchoScreeningPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!o.main || typeof o.main !== 'object') return null;
  const normalized = {
    ...o,
    main: normalizeStoredMain(o.main as Record<string, unknown>),
  };
  const parsed = parseEchoScreeningFromBody({ echoScreening: normalized });
  return parsed.ok ? parsed.value : null;
}

/** Human-readable lines for PDF export */
export function echoScreeningLinesForPdf(payload: EchoScreeningPayload): string[] {
  const lines: string[] = ['SHK Echo-Screening (Nachgespräch):'];
  for (const row of ECHO_MAIN_ROWS) {
    const v = payload.main[row.id];
    lines.push(`  • ${row.categoryDe}: ${formatMainValueForPdf(row.id, v)}`);
  }
  lines.push('  Optional (Kurzcheck):');
  for (const item of ECHO_OPTIONAL_ITEMS) {
    lines.push(`    - ${item.labelDe}: ${payload.optional[item.id] ? 'ja' : 'nein'}`);
  }
  if (payload.comment?.trim()) {
    lines.push(`  Freitext/Kommentar: ${payload.comment.trim()}`);
  }
  const overallLabel = ECHO_OVERALL.find((x) => x.id === payload.overall)?.labelDe ?? payload.overall;
  lines.push(`  Gesamtbeurteilung: ${overallLabel}`);
  return lines;
}
