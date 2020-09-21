if (navigator.serviceWorker) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      swReg = reg
      swReg.pushManager.getSubscription().then(verificaSuscripcion) // (*)
    })
  })
}

// buttons refs
var btnActivadas = document.getElementById('notifActivadas')
var btnDesactivadas = document.getElementById('notifDesactivadas')

// obtiene la public key
function getPublicKey () {
  return fetch('https://webturnos.herokuapp.com/n/key')
    .then(res => res.arrayBuffer())
    .then(key => new Uint8Array(key))
}

// cambia el estado del botón de suscripción
function verificaSuscripcion (activadas) {
  if (activadas) {
    // btnActivadas.classList.remove('oculto')
    btnDesactivadas.classList.add('oculto')
  } else {
    btnActivadas.classList.add('oculto')
    btnDesactivadas.classList.remove('oculto')
  }
}

// click en el botón de suscripción, el browser solicita permiso
btnDesactivadas.addEventListener('click', function () {
  if (!swReg) return console.log('No hay registro de SW')
  getPublicKey().then(key => {
    swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      })
      .then(res => res.toJSON())
      .then(suscripcion => {
        fetch('https://webturnos.herokuapp.com/n/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(suscripcion)
        })
        .then( resp => {
          verificaSuscripcion(resp.ok);
         })
        .catch( cancelarSuscripcon  )

      })
  })
})

// cancel subscription
function cancelarSuscripcon(){
  // Como se hace swReg.pushManager.subscribe() pareciera que lo que tenemos que hacer es un 
  // swReg.pushManager.unsubscribe() pero no, no funciona así, no funciona como un observable de RXJS. 
  swReg.pushManager.getSubscription().then( subs => {
      subs.unsubscribe()
      .then(()=> verificaSuscripcion(false));
  })
}

btnActivadas.addEventListener('click', function(){
  cancelarSuscripcon();
})