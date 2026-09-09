export const families = [
  { en: 'Body panels', zh: '车身面板', color: '#d97922' },
  { en: 'Wheels & tyres', zh: '轮毂与轮胎', color: '#414640' },
  { en: 'Beams & frames', zh: '梁与框架', color: '#8f9983' },
  { en: 'Axles & connectors', zh: '轴与连接件', color: '#7994aa' },
  { en: 'Gears & engine', zh: '齿轮与发动机', color: '#b49e61' },
  { en: 'Other elements', zh: '其他零件', color: '#b2aea2' },
];
// ponytail: descriptions classify part types, not functional assemblies; curated assembly data can replace this later.
export function familyFor(description: string): number {
  if (/tyre|tire|wheel(?!.*steering)/i.test(description)) return 1;
  if (/gear|piston|engine|differential|crankshaft/i.test(description)) return 4;
  if (/panel|fairing|mudguard/i.test(description)) return 0;
  if (/beam|liftarm|frame/i.test(description)) return 2;
  if (/axle|pin|connector|bush|joint/i.test(description)) return 3;
  return 5;
}
