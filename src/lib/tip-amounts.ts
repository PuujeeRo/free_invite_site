// Shared by the tip form (client) and its server action. The bounds also
// appear as a check constraint on public.tips (migration 0014).
export const TIP_PRESETS_MNT = [1000, 5000, 10000, 20000] as const;
export const TIP_DEFAULT_MNT = 5000;
export const TIP_MIN_MNT = 500;
export const TIP_MAX_MNT = 5_000_000;
