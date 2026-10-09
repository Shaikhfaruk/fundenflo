export const SERVICE_NAME = 'fundenflo-api';

export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.otp',
  '*.code',
  '*.password',
  '*.accessToken',
  '*.refreshToken',
  '*.mfaToken',
  '*.token',
  '*.mobile',
  '*.email',
  '*.recipient',
  '*.secret',
];
