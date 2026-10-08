import { PageHeader } from '@/components/page-header';
import { getEmployees, getTitles } from '@/lib/data/employees';
import { formatFte, formatHours, formatKr } from '@/lib/format';
import { EmployeeFormButton, TitleFormButton } from './forms';

export default async function EmployeesPage() {
  const [employees, titles] = await Promise.all([getEmployees(), getTitles()]);
  const partTime = employees.filter((e) => e.capacityFte < 1).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Medarbejdere"
          title={`${employees.length} medarbejdere fordelt på ${titles.length} titler`}
          lede={partTime > 0 ? `${partTime} er på deltid og har mindre end 1,0 FTE at fordele.` : undefined}
        />
        <EmployeeFormButton titles={titles} />
      </div>

      <div className="bd-table-wrap">
        <table className="bd-table">
          <thead>
            <tr>
              <th>Navn</th>
              <th>Titel</th>
              <th className="num">Kapacitet (t/uge)</th>
              <th className="num">FTE</th>
              <th><span className="sr-only">Handlinger</span></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="font-semibold">{employee.name}</td>
                <td>{employee.titleName}</td>
                <td className="num">{formatHours(employee.weeklyCapacity)}</td>
                <td className="num">{formatFte(employee.capacityFte)}</td>
                <td className="text-right">
                  <EmployeeFormButton employee={employee} titles={titles} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="grid gap-4" aria-labelledby="titles-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="bd-page-head">
            <p className="bd-eyebrow">Titler</p>
            <h2 id="titles-heading" className="bd-h2">Titlen bestemmer standardprisen</h2>
            <p className="bd-lede">
              Bruges på projekter med titelpriser, medmindre projektet har aftalt en anden pris. En ændring gælder kun ny
              tid.
            </p>
          </div>
          <TitleFormButton />
        </div>

        <div className="bd-table-wrap">
          <table className="bd-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th className="num">Standardpris (kr./t)</th>
                <th className="num">Medarbejdere</th>
                <th><span className="sr-only">Handlinger</span></th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => (
                <tr key={title.id}>
                  <td className="font-semibold">{title.name}</td>
                  <td className="num">{formatKr(title.standardRate)}</td>
                  <td className="num">{title.employeeCount}</td>
                  <td className="text-right">
                    <TitleFormButton title={title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
