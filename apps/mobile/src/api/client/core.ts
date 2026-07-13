import { getApiBaseUrl } from '../../config/api';
import { ApiTransport } from '../transport';

const transport = new ApiTransport({ baseUrl: getApiBaseUrl });

export const request = transport.request.bind(transport);

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  transport.setUnauthorizedHandler(handler);
}

export function setApiSessionRefreshHandler(handler: (() => Promise<string | null>) | null) {
  transport.setSessionRefreshHandler(handler);
}
