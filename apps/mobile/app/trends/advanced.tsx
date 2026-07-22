import { Redirect } from 'expo-router';

import { routes } from '../../src/navigation/routes';

export default function LegacyAdvancedTrendsRedirect() {
  return <Redirect href={routes.trends} />;
}
