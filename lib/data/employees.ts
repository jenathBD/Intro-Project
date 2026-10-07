import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type EmployeeOption = { id: string; name: string };

// Medarbejdere til valglister, fx i "Registrér tid". currentEmployeeId er den medarbejder,
// der er koblet til det indloggede login (#26/#27), så den kan være valgt på forhånd.
export async function getEmployeeOptions() {
  const session = await requireSession();

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, userId: true },
    orderBy: { name: 'asc' },
  });

  return {
    employees: employees.map(({ id, name }): EmployeeOption => ({ id, name })),
    currentEmployeeId: employees.find((e) => e.userId === session.user.id)?.id ?? null,
  };
}
