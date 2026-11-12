import { ensureInitialAccessCode } from './api/access-codes/access-code.service.ts';
import { env } from './env-validation.ts';

/**
 * One-off tasks when a server or function instance starts. Safe to run on
 * every start: the initial access code is only created once.
 * Errors are logged, not thrown, so a database hiccup does not stop the app.
 */
export async function runStartupTasks(): Promise<void> {
  if (env.AUTH_MODE === 'dev') {
    console.warn(
      'AUTH_MODE=dev: every request is the dev admin user. Never use this in production.',
    );
  }

  try {
    if (await ensureInitialAccessCode()) {
      console.info(
        'Initial admin access code created from INITIAL_ACCESS_CODE. Use it once to sign up as admin.',
      );
    }
  } catch (error) {
    console.error('Could not create the initial access code:', error);
  }
}
