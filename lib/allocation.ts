// Regler for allokering, delt mellem ugegridet (browser) og Server Actionen (#17, #44).

/**
 * Kan projektet allokeres i ugen? Kundeprojekter kun i deres periode (første pakkes start til sidste pakkes slut).
 * Interne og fraværsprojekter har ingen periode (null) og kan altid allokeres.
 */
export function canAllocate(project: { firstWeek: Date | null; lastWeek: Date | null }, week: Date) {
  if (!project.firstWeek || !project.lastWeek) return true;
  return week >= project.firstWeek && week <= project.lastWeek;
}

type ProjectKind = 'client' | 'internal' | 'absence';

// Sortering: kundeprojekter først, så interne, så fravær; inden for hver type dansk alfabetisk (Æ, Ø, Å til sidst)
const KIND_ORDER: Record<ProjectKind, number> = { client: 0, internal: 1, absence: 2 };
export const byKindAndName = (a: { kind: ProjectKind; name: string }, b: { kind: ProjectKind; name: string }) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, 'da');
