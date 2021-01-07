import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

import Token from '../classes/token';
import environment from '../global/environment.prod';

import { User } from '../models/user.model';
import { Menu } from '../models/menu.model';

// Google Login
var GOOGLE_CLIENT_ID = environment.GOOGLE_CLIENT_ID;
const { OAuth2Client } = require("google-auth-library");
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// ========================================================
// User Methods
// ========================================================

function createUser(req: any, res: Response) {

  var body = req.body;
  var user = new User({
    tx_name: body.user.tx_name,
    tx_email: body.user.tx_email,
    tx_password: bcrypt.hashSync(body.user.tx_password, 10),
    bl_google: false,
    tm_lastlogin: null,
    tm_createdat: new Date(),
    id_role: 'ADMIN_ROLE',
  });

  user.save().then((userSaved) => {

    res.status(201).json({
      ok: true,
      msg: "Usuario guardado correctamente.",
      user: userSaved
    });

  }).catch((err) => {

    return res.status(400).json({
      ok: false,
      msg: "Error al guardar el user.",
      errors: err
    });

  });


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

async function verify(token: string) {
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return {
    name: payload.name,
    email: payload.email,
    img: payload.picture,
    google: true,
    payload: payload
  };
}

async function loginGoogle(req: Request, res: Response) {
  var gtoken = req.body.gtoken;
  await verify(gtoken)
    .then((googleUser) => {

      User.findOne({ tx_email: googleUser.email })
        .populate('id_company')
        .then(userDB => {

          if (userDB) {  // el user existe, intenta loguearse

            if (userDB.bl_google === false) {

              return res.status(400).json({
                ok: false,
                msg: "Para el email ingresado debe usar autenticación con clave.",
                user: null
              });

            } else {

              // Google SignIn -> new token
              var token = Token.getJwtToken({ user: userDB });

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

          } else { // el user no existe, hay que crearlo.

            var user = new User();
            user.tx_email = googleUser.email;
            user.tx_name = googleUser.name;
            user.tx_password = ':)';
            user.tx_img = googleUser.img;
            user.bl_google = true;
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
    })
    .catch(err => {
      res.status(403).json({
        ok: false,
        msg: "Token de Google no valido",
        err
      });
    });


}

function loginUser(req: Request, res: Response) {

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

      if (!bcrypt.compareSync(body.tx_password, userDB.tx_password)) {
        return res.status(400).json({
          ok: false,
          msg: "Contraseña o usuario incorrecto."
        });
      }

      // Si llego hasta acá, el user y la contraseña son correctas, creo el token
      var token = Token.getJwtToken({ user: userDB });
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
          case 'SUPERUSER_ROLE':
            home = '/superuser/home';
            break;
          default:
            home = '/waiter/role';
        };

        res.status(200).json({
          ok: true,
          msg: "Login post recibido.",
          token: token,
          body: body,
          id: userDB._id,
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

function obtenerMenu(txRole: string) {

  return new Promise(resolve => {

    let menu_return: any[] = [];

    let menu_indicadores = {
      ricing: 0,
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
          tx_titulo: 'Settings',
          tx_url: '/admin/settings',
          tx_icon: 'mdi mdi-cog'
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
          tx_icon: 'mdi mdi-poll-box',
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

  var user = User.findOne({ tx_email: 'matiasfrith@gmail.com' }, (err, userDB) => {
    return res.json({ data: userDB?.getData() });
  })
}

export = {
  testData,
  createUser,
  attachCompany,
  checkEmailExists,
  updateToken,
  loginGoogle,
  loginUser,
  obtenerMenu
}

