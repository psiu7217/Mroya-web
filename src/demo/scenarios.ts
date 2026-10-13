export const DESIGN_SCENARIOS = ['filled', 'guest', 'user', 'empty', 'loading', 'error', 'guest-typing', 'guest-welcome', 'guest-login', 'guest-invite'] as const;
export type DesignScenario = typeof DESIGN_SCENARIOS[number];
export function designScenario(search: string): DesignScenario {
  const value = new URLSearchParams(search).get('scenario');
  return DESIGN_SCENARIOS.includes(value as DesignScenario) ? value as DesignScenario : 'filled';
}
