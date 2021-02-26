import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

import Token from '../classes/token';
import Mail from '../classes/mail';
import environment from '../global/environment.prod';

import { User } from '../models/user.model';
import { Menu } from '../models/menu.model';
import https from 'https';
import { Social, facebookBackendResponse } from '../models/social.model';

// Google Login
const GOOGLE_CLIENT_ID = environment.GOOGLE_CLIENT_ID;
const { OAuth2Client } = require("google-auth-library");
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function registerUser(req: any, res: Response) {
  // register admins and customers
  
    var body = req.body;
    console.log(req.body)
  
    const id_role = req.body.bl_admin ? 'ADMIN_ROLE' : 'CUSTOMER_ROLE';
    var user = new User({
      bl_active: false,
      tx_name: body.user.tx_name,
      tx_email: body.user.tx_email,
      tx_password: bcrypt.hashSync(body.user.tx_password, 10),
      bl_social: false,
      tx_platform: 'email',
      tm_lastlogin: null,
      tm_createdat: new Date(),
      id_role: id_role,
    });
  
    user.save().then((userSaved) => {
  
      let hash = bcrypt.hashSync(String(userSaved._id), 10);
      hash = hash.replace(/\//gi, '_slash_')
      hash = hash.replace(/\./gi, '_dot_')
      const confirmEmailMessage = `
  Hola ${userSaved.tx_name}, gracias por registrarte en Saturno. 
  
  Para activar tu cuenta por favor hace click aquí:
  
  https://saturno.fun/activate/${userSaved.tx_email}/${hash}`;
  
  
  
      Mail.sendMail('registro', userSaved.tx_email, confirmEmailMessage).then(resp => {
        console.log('mail ok', resp);
      }).catch(err => {
        console.log('fallo', err)
      })
  
      res.status(201).json({
        ok: true,
        msg: "Usuario guardado correctamente.",
        user: userSaved
      });
  
    }).catch((err) => {
      return res.status(400).json({
        ok: false,
        msg: "Error al guardar el usuario.",
        errors: err
      });
  
    });
  
  
  }
  
function activateUser(req: Request, res: Response) {
  // https://localhost/register/activate/rmfrith@yahoo.com.ar/asfasfdasdfasdf

  const email = req.body.email;
  let hash = req.body.hash;
  hash = hash.replace(/_slash_/gi, '/')
  hash = hash.replace(/_dot_/gi, '.')

  User.findOne({ tx_email: email }).then(userDB => {

    if (!userDB) {
      return res.status(400).json({
        ok: false,
        msg: 'No existe el usuario a activar',
        user: null
      })
    }

    if (!bcrypt.compareSync(String(userDB._id), hash)) {
      return res.status(400).json({
        ok: false,
        id: String(userDB._id),
        hash,
        msg: "No se pudo validar el usuario."
      });
    }

    userDB.bl_active = true;
    userDB.save().then(userActivated => {
      return res.status(200).json({
        ok: true,
        msg: 'Usuario activado correctamente',
        user: userActivated
      })
    })

  })


}

async function loginSocial(req: Request, res: Response) {
// login admins social (if not exist then create it)

  const token = req.body.token;
  const socialUser: Social = req.body.user; // social

  await verify(socialUser.txPlatform, token).then(() => {

    User.findOne({ tx_email: socialUser.txEmail })
      .populate('id_company')
      .then(userDB => {

        if (userDB) {
          // el user existe, intenta loguearse

          if (userDB.bl_social === false) {

            return res.status(400).json({
              ok: false,
              msg: "Para el email ingresado debe usar autenticación con clave.",
              user: null
            });

          } else {

            // Google SignIn -> new token

            // rompo la referencia con assign() y uso toObject() para usar extraer del objeto
            // la data que está en userDB._doc con un getter
            let newUser: any = Object.assign({}, userDB.toObject());
            // Le quito tx_company_welcome para evitar problemas con caracteres de 2 bytes 
            // al decodificar con atob() en el frontend
            newUser.id_company = 'eliminado solo para el token';
            var token = Token.getJwtToken({ newUser });

            userDB.updateOne({ tm_lastlogin: + new Date().getTime() })
              .then(async userSaved => {

                userSaved.tx_password = ":)";
                await obtenerMenu(userDB.id_role).then(menu => {


                  let home;
                  switch (userDB.id_role) {
                    case 'ADMIN_ROLE':
                      home = '/admin/home';
                      break;
                    case 'SUPERUSER_ROLE':
                      home = '/superuser/home';
                      break;
                    default:
                      home = '/admin/role';
                  };

                  res.status(200).json({
                    ok: true,
                    msg: 'Login exitoso',
                    token: token,
                    user: userDB,
                    menu,
                    home
                  });

                }).catch(() => {

                  res.status(500).json({
                    ok: false,
                    msg: 'No se pudo obtener el menu del usuario',
                    token: null,
                    user: null,
                    menu: null,
                    home: null
                  })

                })


              }).catch((err) => {

                return res.status(400).json({
                  ok: false,
                  msg: 'Error al loguear el user de Google',
                  err
                });

              });

          }

        } else {
          // el user no existe, hay que crearlo.

          var user = new User();
          user.tx_email = socialUser.txEmail;
          user.tx_name = socialUser.txName;
          user.tx_password = ':)';
          user.tx_img = socialUser.txImage;
          user.bl_social = true;
          user.tx_platform = socialUser.txPlatform;
          user.tm_lastlogin = new Date();
          user.tm_createdat = new Date();
          user.id_role = 'ADMIN_ROLE';
          user.cd_pricing = 0;

          user.save().then(async userSaved => {

            var token = Token.getJwtToken({ user });
            await obtenerMenu(user.id_role).then(menu => {

              res.status(200).json({
                ok: true,
                msg: 'Usuario creado y logueado correctamente',
                token: token,
                user,
                menu,
                home: '/admin/home'
              });
            }).catch(() => {
              res.status(500).json({
                ok: false,
                msg: 'Error al obtener el menu del usuario',
                token: null,
                user: null,
                menu: null,
                home: null
              });
            })
          }).catch((err) => {

            res.status(500).json({
              ok: false,
              msg: 'Error al guardar el user de Google',
              err
            });

          })
        }
      }).catch((err) => {

        res.status(500).json({
          ok: false,
          msg: "Error al buscar user",
          error: err
        });

      })
  }).catch(err => {
    res.status(403).json({
      ok: false,
      msg: "El token no es valido",
      err
    });
  });


}

function loginUser(req: Request, res: Response) {
// login admins and customers with email

  var body = req.body;

  User.findOne({ tx_email: body.tx_email })
    .populate('id_company')
    .then(userDB => {

      if (!userDB) {
        return res.status(400).json({
          ok: false,
          msg: "Usuaro o Contraseña incorrecta."
        });
      }

      if (userDB.bl_social) {
        return res.status(400).json({
          ok: false,
          msg: "Debe ingresar con el botón de " + userDB.tx_platform
        });
      }

      if (!bcrypt.compareSync(body.tx_password, userDB.tx_password)) {
        return res.status(400).json({
          ok: false,
          msg: "Contraseña o usuario incorrecto."
        });
      }

      if (!userDB.bl_active && (userDB.id_role === 'ADMIN_ROLE' || userDB.id_role === 'CUSTOMER_ROLE')) {
        return res.status(400).json({
          ok: false,
          msg: "El usuario no fué activado."
        });
      }


      // Si llego hasta acá, el user y la contraseña son correctas, creo el token

      // rompo la referencia con assign() y uso toObject() para usar extraer del objeto
      // la data que está en userDB._doc con un getter
      let newUser: any = Object.assign({}, userDB.toObject());
      // Le quito tx_company_welcome para evitar problemas con caracteres de 2 bytes 
      // al decodificar con atob() en el frontend
      newUser.id_company = 'eliminado solo para el token';
      var token = Token.getJwtToken({ newUser });

      userDB.tm_lastlogin = new Date();

      userDB.save().then(async () => {

        userDB.tx_password = ":)";

        let home;
        switch (userDB.id_role) {
          case 'WAITER_ROLE':
            home = '/waiter/home';
            break;
          case 'ADMIN_ROLE':
            home = '/admin/home';
            break;
          case 'CUSTOMER_ROLE':
            home = '/public/tickets';
            break;
        };

        if(userDB.id_role === 'CUSTOMER_ROLE'){
          return res.status(200).json({
            ok: true,
            msg: "Cliente logueado correctamente",
            user: userDB,
            home
          });
        }
        
        res.status(200).json({
          ok: true,
          msg: "Usuario logueado correctamente",
          token: token,
          user: userDB,
          menu: await obtenerMenu(userDB.id_role),
          home
        });

      }).catch((err) => {
        return res.status(500).json({
          ok: false,
          msg: "Error al actualizar la fecha de login",
          errors: err
        });
      })

    }).catch((err) => {
      return res.status(500).json({
        ok: false,
        msg: "Error al buscar un user",
        errors: err
      });

    })


}

function attachCompany(req: Request, res: Response) {

  let company = req.body.company;
  let idUser = req.params.idUser;

  User.findByIdAndUpdate(idUser, { 'id_company': company._id }, { new: true })
    .populate('id_company')
    .then(userUpdated => {

      return res.status(200).json({
        ok: true,
        msg: 'La empresa se asigno al user correctamente',
        user: userUpdated
      })
    }).catch(() => {
      return res.status(500).json({
        ok: true,
        msg: 'No se pudo asignar la empresa al user',
        user: null
      })
    })

}

function checkEmailExists(req: Request, res: Response) {

  let pattern = req.body.pattern;
  User.findOne({ tx_email: pattern }).then(userDB => {
    if (!userDB) {
      return res.status(200).json({
        ok: true,
        msg: 'No existe el email'
      })
    }
    return res.status(200).json({
      ok: false,
      msg: 'El email ya existe.'
    })
  }).catch(() => {
    return res.status(500).json({
      ok: false,
      msg: 'Error al consultar si existe el email'
    })
  })

}

function updateToken(req: any, res: Response) {

  let body = req.body;
  var token = Token.getJwtToken({ user: body.user })
  res.status(200).json({
    ok: true,
    user: req.user,
    newtoken: token
  });
}

async function verify(platform: string, token: string): Promise<void> {

  return new Promise(async (resolve, reject) => {
    // GOOGLE TOKEN VERIFY
    if (platform === 'google') {
      const credentials = await oauthClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = credentials.getPayload();
      if( payload.email_verified && payload.exp * 1000 > + new Date()) {
        return resolve();
      } else {
        return reject();
      }
    }

    // FACEBOOK TOKEN VERIFY
    if (platform === 'facebook') {
      const app_id = environment.FB_APP_ID;
      const app_secret = environment.FB_APP_SECRET;
      const access_token_url = 'https://graph.facebook.com/oauth/access_token?client_id=' + app_id + '&client_secret=' + app_secret + '&grant_type=client_credentials';

      // get app_token
      let access_token: string = await new Promise((resolve, reject) => {

        https.get(access_token_url, (response: any) => {
          var body = '';
          response.on('data', function (chunk: any) {
            body += chunk;
          });
          response.on('end', function () {
            var fbResponse = JSON.parse(body);
            resolve(fbResponse.access_token);
          });
        });

      })

      // app_token and user_token validation
      const valid_token = 'https://graph.facebook.com/debug_token?input_token=' + token + '&access_token=' + access_token
      let output: facebookBackendResponse = await new Promise((resolve, reject) => {
        https.get(valid_token, (response: any) => {
          var body = '';
          response.on('data', function (chunk: any) {
            body += chunk;
          });
          response.on('end', function () {
            var fbResponse = JSON.parse(body);
            resolve(fbResponse);
          });
        });
      })

      if (output.data.is_valid) {
        return resolve();
      } else {
        return reject();
      }

    }
  })

}



function obtenerMenu(txRole: string) {

  return new Promise(resolve => {

    let menu_return: any[] = [];

    let menu_indicadores = {
      cd_pricing: 0,
      tx_titulo: 'Indicadores',
      tx_url: '/metrics/dashboard',
      tx_icon: 'mdi mdi-chart-box',
      subitems: [
        {
          tx_titulo: 'Ocio',
          tx_url: '/metrics/ocio',
          tx_icon: 'mdi  mdi-bell-sleep-outline'
        }, {
          tx_titulo: 'Cancelados',
          tx_url: '/metrics/cancelados',
          tx_icon: 'mdi mdi-book-remove-multiple-outline'
        }, {
          tx_titulo: 'Volúmen',
          tx_url: '/metrics/volumen',
          tx_icon: 'mdi mdi-bookmark-multiple-outline'
        }, {
          tx_titulo: 'Atención',
          tx_url: '/metrics/atencion',
          tx_icon: 'mdi mdi-account-clock-outline'
        }, {
          tx_titulo: 'Satisfacción',
          tx_url: '/metrics/satisfaccion',
          tx_icon: 'mdi mdi-emoticon-outline'
        }, {
          tx_titulo: 'Pendientes',
          tx_icon: 'mdi mdi-clock-alert-outline',
          tx_url: '/metrics/pendientes',
          __v: 0
        }, {
          tx_titulo: 'Puntualidad',
          tx_icon: 'mdi mdi-clock-check-outline',
          tx_url: '/metrics/puntualidad',
          __v: 0
        }
      ]
    };

    let menu_admin = {
      tx_titulo: 'Administrador',
      tx_url: '/admin/dashboard',
      tx_icon: 'mdi  mdi-shield-star',
      subitems: [
        {
          tx_titulo: 'Home',
          tx_url: '/admin/home',
          tx_icon: 'mdi mdi-home'
        }, {
          tx_titulo: 'Ajustes',
          tx_url: '/admin/settings',
          tx_icon: 'mdi mdi-cog'
        }, {
          tx_titulo: 'Agenda',
          tx_url: '/admin/schedule',
          tx_icon: 'mdi mdi-calendar-account'
        }, {
          tx_titulo: 'Mi Perfil',
          tx_url: '/admin/profile',
          tx_icon: 'mdi mdi-shield-star'
        }, {
          tx_titulo: 'Wizard',
          tx_icon: 'mdi mdi-wizard-hat',
          tx_url: '/admin/wizard',
        }, {
          tx_titulo: 'Web Page',
          tx_icon: 'mdi   mdi-page-layout-header',
          tx_url: '/admin/webpage'
        }, {
          tx_titulo: 'Comercios',
          tx_url: '/admin/companies',
          tx_icon: 'mdi  mdi-silverware-fork-knife'
        }, {
          tx_titulo: 'Sectores',
          tx_url: '/admin/sections',
          tx_icon: 'mdi mdi-select-group'
        }, {
          tx_titulo: 'Mesas',
          tx_url: '/admin/tables',
          tx_icon: 'mdi  mdi-table-furniture',
        }, {
          tx_titulo: 'Camareros',
          tx_icon: 'mdi   mdi-face',
          tx_url: '/admin/waiters'
        }, {
          tx_titulo: 'Encuestas',
          tx_icon: 'mdi mdi-star',
          tx_url: '/admin/poll',
        }
      ]
    };

    let menu_waiter = {
      tx_titulo: 'Camarero',
      tx_url: '/waiter/dashboard',
      tx_icon: 'mdi mdi-face',
      subitems: [
        {
          tx_titulo: 'Home',
          tx_url: '/waiter/home',
          tx_icon: 'mdi mdi-home'
        }, {
          tx_titulo: 'Dashboard',
          tx_url: '/waiter/dashboard',
          tx_icon: 'mdi mdi-monitor-dashboard'
        }, {
          tx_titulo: 'Mi Sector',
          tx_url: '/waiter/section',
          tx_icon: 'mdi mdi-select-group'
        }
      ]
    };

    if (txRole === 'ADMIN_ROLE') {
      menu_return.push(menu_admin, menu_waiter, menu_indicadores);
    } else {
      menu_return.push(menu_waiter);
    }

    resolve(menu_return);
  })
}

function obtenerMenuDB(txRole: string, cdPricing: number = 0) {

  return new Promise((resolve, reject) => {
    var cdRole: number[] = [];
    switch (txRole) {
      case 'WAITER_ROLE':
        cdRole = [0]; // waiter
        break;
      case 'ADMIN_ROLE':
        cdRole = [0, 1]; // waiter && admin
        break;
      case 'SUPERUSER_ROLE':
        cdRole = [2]; // superuser
    }

    let items: any[] = [];
    let subitems: any[] = [];

    Menu.find({}).then((menuDB) => {

      items = menuDB.filter(item => item.id_parent === null);
      subitems = menuDB.filter(item => item.id_parent !== null);

      // rompo la referencia la objeto de mongoose menuDB 
      let itemsNew = [...items.map((item) => {
        return { ...item._doc };
      })]

      for (let item of itemsNew) {
        item.subitems = subitems.filter(subitem => String(item._id) === String(subitem.id_parent));
      }

      resolve(itemsNew);


    }).catch(() => {
      reject([])
    })

  })
}

function testData(req: Request, res: Response) {
  const animal = 'alligator';
  // Send a text/html file back with the word 'alligator' repeated 1000 times
  res.send(animal.repeat(1000));
  return;
  var user = User.findOne({ tx_email: 'matiasfrith@gmail.com' }, (err, userDB) => {
    return res.json({ data: userDB?.getData() });
  })
}

export = {
  activateUser,
  testData,
  registerUser,
  attachCompany,
  checkEmailExists,
  updateToken,
  verify,
  loginSocial,
  loginUser,
  obtenerMenu
}

