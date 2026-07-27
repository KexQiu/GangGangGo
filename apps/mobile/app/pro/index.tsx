import { Redirect } from 'expo-router';

import { routes } from '../../src/navigation/routes';

export default function ProScreen() {
  return <Redirect href={routes.me} />;
}
