export const families = [
  { label: 'Body panels', color: '#d97922' },
  { label: 'Wheels & tyres', color: '#414640' },
  { label: 'Beams & frames', color: '#8f9983' },
  { label: 'Axles & connectors', color: '#7994aa' },
  { label: 'Engine & transmission', color: '#b49e61' },
  { label: 'Other elements', color: '#b2aea2' },
  { label: 'Steering & suspension', color: '#927c97' },
];
// ponytail: part types approximate systems; exact functional assemblies need curated model data.
export function familyFor(description: string): number {
  if (/steering|suspension|wishbone|shock absorber/i.test(description)) return 6;
  if (
    /gear|engine|differential|crankshaft|driving ring|changeover|clutch|rubber belt/i.test(
      description,
    )
  )
    return 4;
  if (/^(tyre|tire|wheel)\b/i.test(description.trim())) return 1;
  if (/panel|fairing|mudguard/i.test(description)) return 0;
  if (/beam|liftarm|frame|technic,? brick/i.test(description)) return 2;
  if (/^technic/i.test(description) && /axle|pin|connector|bush|joint|link/i.test(description))
    return 3;
  return 5;
}
