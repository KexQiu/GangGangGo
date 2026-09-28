import { getApiBaseUrl } from '../../config/api';
import { authSessionContext, type SessionSnapshot } from '../sessionContext';
import { ApiTransport } from '../transport';

const transport = new ApiTransport({ baseUrl: getApiBaseUrl, sessions: authSessionContext });

export const request = transport.request.bind(transport);

export function setApiUnauthorizedHandler(handler: ((session: SessionSnapshot) => void) | null) {
  transport.setUnauthorizedHandler(handler);
}

export function setApiSessionRefreshHandler(handler: ((session: SessionSnapshot) => Promise<string | null>) | null) {
  transport.setSessionRefreshHandler(handler);
}
