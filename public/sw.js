const CACHE_SHELL = 'cache-shell-0.8'
const CACHE_ASSETS = 'cache-assets-0.8'

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
        '/2.2b201bbce8f335baed23.js',
        '/6.ca4cf768f56307406e87.js',
        '/7.2659bf18d43b7d4e6a76.js',
        '/8.d5c456f49e77aafa8391.js',
        '/9.a102d32e70c2431c5d39.js',
        '/10.6fd0312b8f5c39ce57c8.js',
        '/admin_schedule.314bfb77a946eb28111c.png',
        '/bg-tile.0d3b88f7ce16723156b1.png',
        '/bghome.2374cce18f9d245fa1a9.jpg',
        '/common.b940d5d79626aae57565.js',
        '/main.475d467d7d07bac3c946.js',
        '/polyfills.164a7b585585bfda7685.js',
        '/public_createticket.1a743b1980dd57890e22.png',
        '/public_map.b45a887fa628b9d62971.png',
        '/public_scores.3357dd204cbe02fd7d91.png',
        '/public_ticketform.026e9fb78859513df7c5.png',
        '/public_tickets.11b7f154fb8764573190.png',
        '/runtime.d3a5c59d06d154594be5.js',
        '/saturno-logo.a06910f315a45a70206d.png',
        '/styles.9e927c6b6eab3459145d.css',
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
        '/offline.html',
        '/favicon.ico',
        '/manifest.json',
        '/assets/pwa.css',
        '/assets/bell.wav',
        '/assets/img/map/duff-beer.svg',
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
