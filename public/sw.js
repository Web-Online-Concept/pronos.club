self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title ?? "PRONOS.CLUB";
  const options = {
    body: data.body ?? "Nouveau pronostic disponible !",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url ?? "/fr/pronostics" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/fr/pronostics";
  event.waitUntil(clients.openWindow(url));
});
