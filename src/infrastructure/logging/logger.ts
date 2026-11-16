import pino, { type DestinationStream, type LevelWithSilent } from 'pino';

export function createLogger(level: LevelWithSilent = 'info', destination?: DestinationStream) {
  return pino({
    level,
    redact: {
      paths: ['token', 'wstoken', 'privatetoken', 'password', 'MOODLE_TOKEN',
        '*.token', '*.wstoken', '*.privatetoken', '*.password', '*.MOODLE_TOKEN'],
      censor: '[REDACTED]',
    },
  }, destination ?? pino.destination(2));
}
