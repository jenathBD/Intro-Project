import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type CategoryOption = { id: string; name: string };

// Kategorier til valglisten på arbejdspakker (#14), dansk alfabetisk
export async function getCategories(): Promise<CategoryOption[]> {
  await requireSession();
  const categories = await prisma.workPackageCategory.findMany({ select: { id: true, name: true } });
  return categories.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}
