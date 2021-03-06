const CACHE_SHELL = 'cache-shell-2.7.12'
const CACHE_ASSETS = 'cache-assets-2.7.12'

// ----------------------------------------------------------
// app shell
// ----------------------------------------------------------

self.addEventListener('install', e => {
  let static = caches
    .open(CACHE_SHELL)
    .then(cache => {
      // waitUntil espera una promesa por lo tanto tengo que usar RETURN
      return cache.addAll([
        '/',
        '/2.5e06b136251db4feaafc.js',
        '/6.893cb0e85bc4da6c37ce.js',
        '/7.db3fac2c1095c1a81646.js',
        '/8.7a49a1c3141f8956c339.js',
        '/9.a90bafa87b2138555a69.js',
        '/10.b4ae6036d59b64149b31.js',
        '/admin_schedule.314bfb77a946eb28111c.png',
        '/bghome.d7e22d58974a14d07932.jpg',
        '/common.514a9a3682e8808291f6.js',
        '/food-red.0d3b88f7ce16723156b1.png',
        '/main.73054bba9d248a2fb020.js',
        '/polyfills.70783a9f5a03890b8d8a.js',
        '/public_createticket.1a743b1980dd57890e22.png',
        '/public_map.b45a887fa628b9d62971.png',
        '/public_scores.3357dd204cbe02fd7d91.png',
        '/public_ticketform.026e9fb78859513df7c5.png',
        '/public_tickets.11b7f154fb8764573190.png',
        '/runtime.869ea82a1069d3d45004.js',
        '/saturno-logo.a06910f315a45a70206d.png',
        '/styles.c39ff60c4935cdff86c5.css',
        '/waiter_tables.3f32ade65761a1adf34d.png',
        '/waiter_virtualqueue.deda2d88bfa36bef5034.png'

      ])
    })
    .catch(() => {
      console.log('error al crear la app shell')
    })

  let assets = caches
    .open(CACHE_ASSETS)
    .then(cache => {
      return cache.addAll([
        '/app.js',
        '/favicon.ico',
        '/manifest.json',
        '/assets/bell.wav',
        '/assets/css/pwa.css',
        '/assets/themes/dark-pink.css',
        '/assets/themes/dark-green.css',
        '/assets/themes/grey-dark.css',
        '/assets/themes/grey-orange.css',
        '/assets/themes/light-blue.css',
        '/assets/themes/light-green.css',
        '/assets/img/icons/logo72x72.png',
        '/assets/img/icons/logo96x96.png',
        '/assets/img/icons/logo128x128.png',
        '/assets/img/icons/logo144x144.png',
        '/assets/img/icons/logo152x152.png',
        '/assets/img/icons/logo192x192.png',
        '/assets/img/icons/logo384x384.png',
        '/assets/img/icons/logo512x512.png',
        '/assets/img/icons-ios/apple-launch-640x1136.png',
        '/assets/img/icons-ios/apple-launch-750x1334.png',
        '/assets/img/icons-ios/apple-launch-1125x2436.png',
        '/assets/img/icons-ios/apple-launch-1242x2208.png',
      ])
    })
    .catch(() => {
      console.log('error al crear el cache assets')
    })

  e.waitUntil(Promise.all([assets, static]))
})

// ----------------------------------------------------------
// delete old static cache
// ----------------------------------------------------------
self.addEventListener('activate', e => {
  const respuesta = caches.keys().then(keys => {
    keys.forEach(key => {
      if (key !== CACHE_SHELL && key.includes('static')) {
        return caches.delete(key)
      }

    })
  })
  e.waitUntil(respuesta)
})

// ----------------------------------------------------------
// 2. Strategy: Cache with network fallback
// ----------------------------------------------------------

self.addEventListener('fetch', e => {

  const respuesta = fetch(e.request).then(resp => {

    if (!resp) {
      // si no lo encuentra en inet intenta obtenerlo del cache
      return caches.match(e.request);
    }

    if (e.request.method !== 'POST') {
      caches.open(CACHE_SHELL).then(cache => {
        cache.put(e.request, resp.clone())
      })
    }
    return resp.clone()

  }).catch(() => {

    if (e.request.headers.get('accept')) {
      if (e.request.headers.get('accept').includes('text/html')) {
        return caches.match('/offline.html')
      }
    }

    return new Response(`
          No hay conexión a Internet. 
          Saturno necesita obtener información de Internet. 
          Por favor verificá tu conexión y volver a cargar la página.
          `);

  })

  e.respondWith(respuesta)
})




// escuchar push
self.addEventListener('push', e => {
  const data = JSON.parse(e.data.text())
  const title = data.title
  const msg = data.msg

  const options = {
    body: msg,
    vibrate: [
      0,
      300,
      100,
      50,
      100,
      50,
      100,
      50,
      100,
      50,
      100,
      50,
      100,
      50,
      150,
      150,
      150,
      450,
      100,
      50,
      100,
      50,
      150,
      150,
      150,
      450,
      100,
      50,
      100,
      50,
      150,
      150,
      150,
      450,
      150,
      150
    ],
    icon: 'assets/img/icons/icon-72x72.png',
    badge: 'img/favicon.ico',
    openUrl: 'https://saturno.fun',
    data: {
      url: 'https://saturno.fun'
    },
    actions: [
      // solo permite dos acciones válidas se muestran como BOTONES en la notificación.
      {
        action: 'ver-pantalla',
        title: 'Ver Pantalla'
        // icon: 'assets/avatars/thor.jpg'
      },
      {
        action: 'obtener-turno',
        title: 'Obtener Turno'
        // icon: 'assets/avatars/ironman.jpg'
      }
    ]
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  const notificacion = e.notification
  const accion = e.action
  notificacion.close()
})

self.addEventListener('notificationclick', e => {
  const notificacion = e.notification
  const accion = e.action
  //matchAll() busca en todas las pestañas abiertas del mismo sitio, y regresa una promesa
  const respuesta = clients.matchAll().then(clientes => {
    // clientes es un array de todos los tabs abiertos de mi aplicación yo sólo quiero el que se encuentra visible
    let cliente = clientes.find(c => {
      return c.visibilityState === 'visible'
    })
    if (cliente !== undefined) {
      cliente.navigate(notificacion.data.url)
      cliente.focus()
    } else {
      clients.openWindow(notificacion.data.url) // me abre una nueva pestaña pero no es lo que yo quiero
    }
    return notificacion.close()
  })
  e.waitUntil(respuesta)
})
