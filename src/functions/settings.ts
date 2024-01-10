// we might want to leave this up to the server

// session_min_expire_hours and session_max_expire_hours determine the boundaries
// for updating the session expiration date when the session is used.
// if a session is used and the expiration date is lower then session_min_expire_hours,
// the expiration date is updated to session_max_expire_hours.

const settings = {
  session_min_expire_hours: 24 * 7,
  session_max_expire_hours: 24 * 14,
  access_expire_minutes_browser: 10,
  access_expire_minutes_api: 60 * 3,
};
export default settings;
