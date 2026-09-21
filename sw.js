/* DRIVON PASSAGEIRO — service worker só de Web Push (sem cache de app) */

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

/* Push real vindo do servidor (VAPID / Web Push) — funciona com o app fechado */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {
        data = { title: "Drivon", body: event.data ? event.data.text() : "" };
      }
      const title = data.title || "Drivon";
      const url = data.url || "/";
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || url,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        icon: "/favicon-192.png",
        badge: "/favicon-192.png",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of list) {
        if (c.url === target && "focus" in c) return c.focus();
      }
      for (const c of list) {
        if ("focus" in c) {
          try {
            const nav = c.navigate ? await c.navigate(target) : null;
            await (nav || c).focus();
            return;
          } catch {
            /* cliente não navegável: abre uma nova janela */
          }
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
