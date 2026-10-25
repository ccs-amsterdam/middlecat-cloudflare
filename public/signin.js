// Sign in buttons (Better Auth endpoints under /api/auth), sign out buttons and form loading state.
(function () {
  "use strict";

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
  }

  document.querySelectorAll("[data-signout]").forEach(function (button) {
    button.addEventListener("click", function () {
      button.classList.add("Loading");
      postJSON("/api/auth/sign-out").finally(function () {
        window.location.reload();
      });
    });
  });

  document.querySelectorAll("form[data-loading-form]").forEach(function (form) {
    form.addEventListener("submit", function () {
      var button = form.querySelector("button[type=submit]");
      if (button) button.classList.add("Loading");
    });
  });

  var root = document.getElementById("signin");
  if (!root) return;

  var callbackURL = root.dataset.callbackUrl || "/";
  var errorCallbackURL = "/signin?callbackURL=" + encodeURIComponent(callbackURL);
  var errorBox = document.getElementById("signin-error");
  var providers = document.getElementById("signin-providers");
  var emailLogin = document.getElementById("signin-email");

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  // the message for a 429 explains which limit was hit (see lib/usage.ts)
  function errorMessage(res) {
    if (res.status !== 429) return Promise.resolve("Could not sign in. Please try again.");
    return res
      .json()
      .then(function (body) {
        return (body && body.message) || "Too many attempts. Please try again later.";
      })
      .catch(function () {
        return "Too many attempts. Please try again later.";
      });
  }

  root.querySelectorAll("button[data-provider]").forEach(function (button) {
    button.addEventListener("click", function () {
      button.classList.add("Loading");
      errorBox.classList.add("hidden");
      postJSON("/api/auth/sign-in/social", {
        provider: button.dataset.provider,
        callbackURL: callbackURL,
        errorCallbackURL: errorCallbackURL,
      })
        .then(function (res) {
          if (!res.ok)
            return errorMessage(res).then(function (message) {
              throw new Error(message);
            });
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.url) throw new Error("Could not sign in. Please try again.");
          window.location.href = data.url;
        })
        .catch(function (e) {
          button.classList.remove("Loading");
          showError(e.message);
        });
    });
  });

  if (!emailLogin) return;

  document.getElementById("signin-email-open").addEventListener("click", function () {
    providers.classList.add("hidden");
    emailLogin.classList.remove("hidden");
    document.getElementById("email").focus();
  });

  document.getElementById("signin-email-back").addEventListener("click", function () {
    emailLogin.classList.add("hidden");
    providers.classList.remove("hidden");
    errorBox.classList.add("hidden");
  });

  var emailForm = document.getElementById("signin-email-form");
  emailForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var button = emailForm.querySelector("button[type=submit]");
    button.classList.add("Loading");
    errorBox.classList.add("hidden");
    postJSON("/api/auth/sign-in/magic-link", {
      email: emailForm.email.value,
      callbackURL: callbackURL,
      errorCallbackURL: errorCallbackURL,
    })
      .then(function (res) {
        if (res.status === 429)
          return errorMessage(res).then(function (message) {
            throw new Error(message);
          });
        if (!res.ok) throw new Error("Could not send the email. Please try again.");
        window.location.href = "/email_sent";
      })
      .catch(function (e) {
        button.classList.remove("Loading");
        showError(e.message);
      });
  });
})();
