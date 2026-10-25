// Dashboard: the servers the user signed in to, their sessions, ending sessions and forgetting servers.
(function () {
  "use strict";

  var ICON_CLOSE =
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144m224 0L144 368"></path></svg>';

  var list = document.getElementById("servers");
  var popup = document.getElementById("popup");

  function loadSessions() {
    return fetch("/api/sessions", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (res) {
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("Could not fetch sessions");
        return res.json().then(render);
      })
      .catch(function () {
        list.replaceChildren();
        document.getElementById("sessions-error").classList.remove("hidden");
      });
  }

  function request(method, url) {
    return fetch(url, { method: method, credentials: "same-origin" }).then(loadSessions);
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function iconButton(title) {
    var button = el("button");
    button.type = "button";
    button.title = title;
    button.innerHTML = ICON_CLOSE; // constant markup
    return button;
  }

  function sessionRow(session) {
    var row = el("div", "AmcatSession");
    var details = el("div", "Details");
    details.appendChild(el("div", "Label", session.createdOn || "Unknown device"));
    details.appendChild(
      el("div", "Context", "Signed in " + new Date(session.createdAt).toDateString() + ", until " + new Date(session.expires).toDateString()),
    );
    var buttons = el("div", "Buttons");
    var close = iconButton("End this session");
    close.addEventListener("click", function () {
      request("DELETE", "/api/sessions/" + encodeURIComponent(session.id));
    });
    buttons.appendChild(close);
    row.appendChild(details);
    row.appendChild(buttons);
    return row;
  }

  function serverBlock(server) {
    var block = el("div", "ServerBlock");
    var header = el("div", "ServerHeader");
    header.appendChild(el("h3", "", server.server));
    var forget = el("button", "ForgetButton", "Forget");
    forget.type = "button";
    forget.title = "End all sessions at this server, and ask for confirmation next time";
    forget.addEventListener("click", function (e) {
      e.stopPropagation();
      confirmPopup(forget, "Sign out of " + server.server + " everywhere, and ask for confirmation next time?", function () {
        request("DELETE", "/api/servers/" + encodeURIComponent(server.server));
      });
    });
    header.appendChild(forget);
    block.appendChild(header);
    if (server.sessions.length === 0) block.appendChild(el("div", "Context", "No active sessions"));
    server.sessions.forEach(function (session) {
      block.appendChild(sessionRow(session));
    });
    return block;
  }

  function render(data) {
    document.getElementById("sessions-error").classList.add("hidden");
    document.getElementById("servers-empty").classList.toggle("hidden", data.servers.length > 0);
    list.replaceChildren.apply(list, data.servers.map(serverBlock));
  }

  // Popup for confirming
  var popupTrigger = null;

  function closePopup() {
    popup.classList.remove("open");
    popup.replaceChildren();
    popupTrigger = null;
  }

  function confirmPopup(trigger, question, action) {
    if (popupTrigger === trigger) return closePopup();
    popup.replaceChildren(el("h4", "", question));
    var yes = el("button");
    yes.type = "button";
    yes.appendChild(el("span", "", "Yes"));
    yes.addEventListener("click", function () {
      closePopup();
      action();
    });
    popup.appendChild(yes);
    popup.classList.add("open");
    popupTrigger = trigger;

    var rect = trigger.getBoundingClientRect();
    var top = rect.y - popup.scrollHeight - 25;
    var left = rect.x - (popup.clientWidth - rect.width) / 2;
    // Ensure popup doesn't go off screen
    top = Math.max(0, Math.min(top, window.innerHeight - popup.scrollHeight));
    left = Math.max(0, Math.min(left, window.innerWidth - popup.clientWidth));
    popup.style.top = top + "px";
    popup.style.left = left + "px";
  }

  document.addEventListener("click", function (e) {
    if (popupTrigger && !popup.contains(e.target) && !popupTrigger.contains(e.target)) closePopup();
  });

  loadSessions();
})();
