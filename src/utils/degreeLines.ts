// Identity.degreeYear from ReCiter is { bachelorYear, doctoralYear }, with 0 when unknown.
// Returns display lines for the profile sheet, e.g. ["1995 Bachelors", "2009 Doctoral"].
export const degreeLines = (degreeYear: any): string[] => {
  const lines: string[] = [];
  const add = (year: any, type: string) => {
    const y = Number(year);
    if (Number.isInteger(y) && y > 0) lines.push(`${y} ${type}`);
  };
  add(degreeYear?.bachelorYear, 'Bachelors');
  add(degreeYear?.doctoralYear, 'Doctoral');
  return lines;
};
