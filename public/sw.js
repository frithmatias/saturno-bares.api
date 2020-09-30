const CACHE_STATIC = 'static-0.1'
const CACHE_DYNAMIC = 'dynamic-0.1'
const CACHE_INMUTABLE = 'inmutable-0.1'

// ----------------------------------------------------------
// app shell
// ----------------------------------------------------------
self.addEventListener('install', e => {
  let static = caches
    .open(CACHE_STATIC)
    .then(cache => {
      // waitUntil espera una promesa por lo tanto tengo que usar RETURN
      return cache.addAll([
        '/',
        '/index.html',
        '/55.8cb65e073d47da8fe9e8.js',
        '/66.1d9750f3cab9ef3b3797.js',
        '/77.e2cbd93621b2cd0abde4.js',
        '/88.31e8b685d97edeca80b0.js',
        '/99.4b45bd400678b96b4d3b.js',
        '/bbghome.2374cce18f9d245fa1a9.jpg',
        '/bbgtile1.24387b8acb702323a6b6.png',
        '/bbgtile2.916b8a1f682edacc68a2.png',
        '/bbgtile3.0df35a810f9f086285c1.png',
        '/ccommon.14facb5e31e9f97fc6b0.js',
        '/mmain.240eb9cfc42c6012eb69.js',
        '/ppolyfills.5aab4676029f8f7a1213.js',
        '/rruntime.10644e8ba603d43616ed.js',
        '/sstyles.52a58422e0ab5e258e7f.css'
      ])
    })
    .catch(() => {
      console.log('error al crear la app shell')
    })

  let inmutable = caches
    .open(CACHE_INMUTABLE)
    .then(cache => {
      return cache.addAll([
        '/app.js',
        '/favicon.ico',
        '/manifest.json',
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
        '/assets/img/mean-mini.png',
        '/assets/img/noti-off.png',
        '/assets/img/noti-on.png',
        '/assets/img/saturn.png',
        '/assets/bell.wav',
        '/assets/pwa.css',
      ])
    })
    .catch(() => {
      console.log('error al crear el cache inmutable')
    })

  e.waitUntil(Promise.all([inmutable, static]))
})

// ----------------------------------------------------------
// delete old static cache
// ----------------------------------------------------------
self.addEventListener('activate', e => {
  const respuesta = caches.keys().then(keys => {
    keys.forEach(key => {
      if (key !== CACHE_STATIC && key.includes('static')) {
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
  if (
    e.request.url.includes('saturno') ||
    e.request.url.includes('herokuapp') ||
    e.request.url.includes('localhost')
  ) {
    // las peticiones GET no debe guardarlas en cache
    const respuesta = fetch(e.request).then(resp => {
      return resp
    })
    e.respondWith(respuesta)
  } else {
    const respuesta = caches
      .match(e.request)
      .then(resp => {
        if (resp) {
          return resp
        }
        return fetch(e.request).then(resp => {
          if (e.request.method !== 'POST') {
            caches.open(CACHE_DYNAMIC).then(cache => {
              cache.put(e.request, resp.clone())
            })
          }
          return resp.clone()
        })
      })
      .catch(err => {
        if (e.request.headers.get('accept').includes('text/html')) {
          return caches.match('/offline.html')
        }
      })
    e.respondWith(respuesta)
  }
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
  // como toda accion en el SW tengo que esperar a que termine de realizar toda la notificación
  // porque puede demorar unos segundos.
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
