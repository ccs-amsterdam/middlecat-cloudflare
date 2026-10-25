const settings = {
  // A login at a server lasts up to session_max_age_hours. When it's used (refreshed) and less than
  // session_update_age_hours remain, it's extended to session_max_age_hours again.
  session_max_age_hours: 24 * 14,
  session_update_age_hours: 24 * 7,
  access_expire_minutes: 10,
  // how long an authorization code can be exchanged for tokens
  code_expire_minutes: 10,
  // after a refresh token is rotated, the previous token can be used again for this long (e.g. concurrent requests
  // from several browser tabs), and returns the same new token. Reuse after this period is treated as theft.
  refresh_grace_seconds: 60,
  // signing keys are rotated every period. A key is published one period before it is used,
  // and stays published until all tokens signed with it have expired.
  signing_key_period_days: 30,
  // Daily login limits (UTC days). Servers with a budget set by an admin (serverBudget) only count against
  // their own budget. Logins are counted when they are started (magic link sent, or redirect to GitHub/Google).
  limits: {
    global: { email: 1000, github: 5000, google: 5000 },
    perServer: { email: 100, social: 1000 },
  },
};
export default settings;
