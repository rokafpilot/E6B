export type UnitCategory =
  | 'distance'
  | 'speed'
  | 'time'
  | 'temperature'
  | 'pressure'
  | 'volume'
  | 'rate'
  | 'weight'
  | 'climbRate'
  | 'angle'
  | 'torque'
  | 'climbAngle'
  | 'density';

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  category: UnitCategory;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
}

export const UNITS: UnitDefinition[] = [
  // Distance (base: meter)
  { id: 'm', name: 'Meter', symbol: 'm', category: 'distance', toBase: (v) => v, fromBase: (v) => v },
  { id: 'km', name: 'Kilometer', symbol: 'km', category: 'distance', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  { id: 'ft', name: 'Foot', symbol: 'ft', category: 'distance', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  { id: 'nm', name: 'Nautical Mile', symbol: 'NM', category: 'distance', toBase: (v) => v * 1852, fromBase: (v) => v / 1852 },
  { id: 'mi', name: 'Statute Mile', symbol: 'mi', category: 'distance', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  { id: 'in', name: 'Inch', symbol: 'in', category: 'distance', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },

  // Speed (base: m/s)
  { id: 'mps', name: 'Meters per Second', symbol: 'm/s', category: 'speed', toBase: (v) => v, fromBase: (v) => v },
  { id: 'kt', name: 'Knot', symbol: 'kt', category: 'speed', toBase: (v) => v * (1852 / 3600), fromBase: (v) => v / (1852 / 3600) },
  { id: 'kmh', name: 'Kilometer per Hour', symbol: 'km/h', category: 'speed', toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
  { id: 'mph', name: 'Miles per Hour', symbol: 'mph', category: 'speed', toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
  { id: 'fps', name: 'Feet per Second', symbol: 'fps', category: 'speed', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  { id: 'mach', name: 'Mach', symbol: 'M', category: 'speed', toBase: (v) => v * 340.29, fromBase: (v) => v / 340.29 },

  // Time (base: second)
  { id: 's', name: 'Second', symbol: 's', category: 'time', toBase: (v) => v, fromBase: (v) => v },
  { id: 'min', name: 'Minute', symbol: 'min', category: 'time', toBase: (v) => v * 60, fromBase: (v) => v / 60 },
  { id: 'h', name: 'Hour', symbol: 'hr', category: 'time', toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },

  // Temperature (base: Celsius)
  { id: 'c', name: 'Celsius', symbol: '°C', category: 'temperature', toBase: (v) => v, fromBase: (v) => v },
  { id: 'f', name: 'Fahrenheit', symbol: '°F', category: 'temperature', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => (v * 9 / 5) + 32 },
  { id: 'k', name: 'Kelvin', symbol: 'K', category: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },

  // Pressure (base: hectopascal hPa)
  { id: 'hpa', name: 'Hectopascal', symbol: 'hPa', category: 'pressure', toBase: (v) => v, fromBase: (v) => v },
  { id: 'inhg', name: 'Inches of Mercury', symbol: 'inHg', category: 'pressure', toBase: (v) => v * 33.86389, fromBase: (v) => v / 33.86389 },
  { id: 'mb', name: 'Millibar', symbol: 'mb', category: 'pressure', toBase: (v) => v, fromBase: (v) => v },
  { id: 'psi', name: 'Pound per Square Inch', symbol: 'psi', category: 'pressure', toBase: (v) => v * 68.94757, fromBase: (v) => v / 68.94757 },

  // Volume (base: liter)
  { id: 'l', name: 'Liter', symbol: 'L', category: 'volume', toBase: (v) => v, fromBase: (v) => v },
  { id: 'gal_us', name: 'US Gallon', symbol: 'gal', category: 'volume', toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  { id: 'gal_imp', name: 'Imperial Gallon', symbol: 'gal (imp)', category: 'volume', toBase: (v) => v * 4.54609, fromBase: (v) => v / 4.54609 },

  // Rate / Flow (base: liter per hour JetA1 equiv)
  { id: 'lph', name: 'Liter per Hour', symbol: 'L/hr', category: 'rate', toBase: (v) => v, fromBase: (v) => v },
  { id: 'gph_us', name: 'US Gal per Hour', symbol: 'gal/hr', category: 'rate', toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  { id: 'pph', name: 'Pound per Hour', symbol: 'lb/hr', category: 'rate', toBase: (v) => v * 0.453592 / 0.804, fromBase: (v) => v / 0.453592 * 0.804 },
  { id: 'kph_flow', name: 'Kg per Hour', symbol: 'kg/hr', category: 'rate', toBase: (v) => v / 0.804, fromBase: (v) => v * 0.804 },

  // Weight (base: kilogram)
  { id: 'kg', name: 'Kilogram', symbol: 'kg', category: 'weight', toBase: (v) => v, fromBase: (v) => v },
  { id: 'lb', name: 'Pound', symbol: 'lb', category: 'weight', toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
  { id: 'ton_us', name: 'US Ton', symbol: 'ton', category: 'weight', toBase: (v) => v * 907.185, fromBase: (v) => v / 907.185 },

  // Climb Rate (base: meter per second)
  { id: 'mps_climb', name: 'Meters per Second', symbol: 'm/s', category: 'climbRate', toBase: (v) => v, fromBase: (v) => v },
  { id: 'fpm', name: 'Feet per Minute', symbol: 'fpm', category: 'climbRate', toBase: (v) => v * 0.3048 / 60, fromBase: (v) => v / 0.3048 * 60 },
  { id: 'mpm', name: 'Meters per Minute', symbol: 'm/min', category: 'climbRate', toBase: (v) => v / 60, fromBase: (v) => v * 60 },

  // Angle (base: degree)
  { id: 'deg', name: 'Degree', symbol: '°', category: 'angle', toBase: (v) => v, fromBase: (v) => v },
  { id: 'rad', name: 'Radian', symbol: 'rad', category: 'angle', toBase: (v) => v * 180 / Math.PI, fromBase: (v) => v * Math.PI / 180 },
  { id: 'grad', name: 'Gradian', symbol: 'grad', category: 'angle', toBase: (v) => v * 0.9, fromBase: (v) => v / 0.9 },
  { id: 'slope_pct', name: 'Percent Slope', symbol: '%', category: 'angle', toBase: (v) => Math.atan(v / 100) * 180 / Math.PI, fromBase: (v) => 100 * Math.tan(v * Math.PI / 180) },

  // Torque (base: newton meter)
  { id: 'nm_torque', name: 'Newton Meter', symbol: 'N·m', category: 'torque', toBase: (v) => v, fromBase: (v) => v },
  { id: 'lbft', name: 'Pound-Foot', symbol: 'lb·ft', category: 'torque', toBase: (v) => v * 1.35582, fromBase: (v) => v / 1.35582 },
  { id: 'kgin', name: 'Kilogram-Inch', symbol: 'kg·in', category: 'torque', toBase: (v) => v * 0.867962, fromBase: (v) => v / 0.867962 },

  // Climb/Glide Angle (base: degree, separate category for UI)
  { id: 'deg_climb', name: 'Degree', symbol: '°', category: 'climbAngle', toBase: (v) => v, fromBase: (v) => v },
  { id: 'ratio', name: 'Glide Ratio (x:1)', symbol: ':1', category: 'climbAngle', toBase: (v) => Math.atan(1 / v) * 180 / Math.PI, fromBase: (v) => 1 / Math.tan(v * Math.PI / 180) },

  // Density (base: kg per Liter = SG · water = 1.0)
  { id: 'kg_l', name: 'Kg per Liter', symbol: 'kg/L', category: 'density', toBase: (v) => v, fromBase: (v) => v },
  { id: 'sg', name: 'Specific Gravity', symbol: 'SG', category: 'density', toBase: (v) => v, fromBase: (v) => v },
  { id: 'lb_gal_us', name: 'Lb per US Gal', symbol: 'lb/gal', category: 'density', toBase: (v) => v * 0.453592 / 3.78541, fromBase: (v) => v / 0.453592 * 3.78541 },
  { id: 'lb_gal_imp', name: 'Lb per Imp Gal', symbol: 'lb/gal (i)', category: 'density', toBase: (v) => v * 0.453592 / 4.54609, fromBase: (v) => v / 0.453592 * 4.54609 },
];

export function convertUnits(value: number, fromUnitId: string, toUnitId: string): number {
  const from = UNITS.find(u => u.id === fromUnitId);
  const to = UNITS.find(u => u.id === toUnitId);
  if (!from || !to) throw new Error(`Unknown unit: ${fromUnitId} or ${toUnitId}`);
  if (from.category !== to.category) throw new Error(`Unit category mismatch: ${from.category} vs ${to.category}`);
  const base = from.toBase(value);
  return to.fromBase(base);
}

export function getUnitsByCategory(category: UnitCategory): UnitDefinition[] {
  return UNITS.filter(u => u.category === category);
}

export function getUnitById(id: string): UnitDefinition | undefined {
  return UNITS.find(u => u.id === id);
}

export const CATEGORIES: { id: UnitCategory; name: string }[] = [
  { id: 'distance', name: 'Distance' },
  { id: 'speed', name: 'Speed' },
  { id: 'time', name: 'Time' },
  { id: 'temperature', name: 'Temperature' },
  { id: 'pressure', name: 'Pressure' },
  { id: 'volume', name: 'Volume' },
  { id: 'rate', name: 'Flow Rate' },
  { id: 'weight', name: 'Weight' },
  { id: 'climbRate', name: 'Climb Rate' },
  { id: 'angle', name: 'Angle' },
  { id: 'torque', name: 'Torque' },
  { id: 'climbAngle', name: 'Climb / Glide Angle' },
  { id: 'density', name: 'Density / SG' },
];
