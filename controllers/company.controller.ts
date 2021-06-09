import { Request, Response } from 'express';
import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Settings } from '../models/settings.model';
import { ScoreItem } from '../models/scoreitem.model';
import { Notification } from '../models/notification.model';
import Server from '../classes/server';

// ========================================================
// Company Methods
// ========================================================

function createCompany(req: Request, res: Response) {

  const server = Server.instance; // singleton


  // Save Company
  var body = req.body;

  var company = new Company({
    id_user: body.id_user,
    tx_company_type: body.tx_company_type,
    tx_company_name: body.tx_company_name,
    tx_company_slogan: body.tx_company_slogan,
    tx_company_string: body.tx_company_string,
    tx_company_location: body.tx_company_location,
    cd_company_location: body.cd_company_location,
    tx_company_lat: body.tx_company_lat,
    tx_company_lng: body.tx_company_lng,
    tx_address_street: body.tx_address_street,
    tx_address_number: body.tx_address_number,
    tm_start: null,
    tm_end: null
  });

  company.save().then((companySaved) => {

    const notif = new Notification({ // CONFIG PORTAL
      id_owner: [companySaved._id],
      tx_icon: 'mdi-web',
      tx_title: `Completa tu Portal Web`,
      tx_message: `Tu comercio ${companySaved.tx_company_name} ya está creado. Te invitamos a configurar tu portal web haciendo click acá.`,
      tm_notification: new Date(),
      tm_event: null,
      tx_link: '/admin/webpage'
    });
    notif.save();
    server.io.to(companySaved._id).emit('update-admin'); // table reserved

    let defaultSettings = new Settings({
      id_company: companySaved._id,
      bl_spm: true,
      bl_schedule: true,
      bl_queue: true,
      nm_intervals: 3
    })

    defaultSettings.save().then(settingsSaved => {

      return res.status(200).json({
        ok: true,
        msg: 'Comercio creado correctamente',
        settings: settingsSaved,
        company: companySaved
      })
    }).catch(() => {

      return res.status(400).json({
        ok: false,
        msg: 'Error al guardar las configuraciones iniciales',
        company: null
      })

    })

  }).catch((err) => {

    return res.status(400).json({
      ok: false,
      msg: 'Error al guardar el comercio',
      company: err
    })

  })

}

function readCompany(req: Request, res: Response) {
  var txCompanyString = String(req.params.txCompanyString);

  Company.findOne({ tx_company_string: txCompanyString }).then(companyDB => {

    if (!companyDB) {
      return res.status(200).json({
        ok: false,
        msg: "No existe la empresa",
        company: null
      });
    }

    res.status(200).json({
      ok: true,
      msg: 'Empresa obtenida correctamente',
      company: companyDB
    });

  }).catch(() => {
    return res.status(500).json({
      ok: false,
      msg: "Error al buscar el user",
      company: null
    });
  })
}

function readCompanies(req: Request, res: Response) {

  var idUser = String(req.params.idUser);
  Company.find({ id_user: idUser }).then(companiesDB => {

    if (companiesDB.length === 0) {
      return res.status(200).json({
        ok: false,
        msg: "No existen empresas asociadas al usuario",
        companies: []
      });
    }

    res.status(200).json({
      ok: true,
      msg: 'Empresas obtenidas correctamente',
      companies: companiesDB
    });

  }).catch(() => {
    return res.status(500).json({
      ok: false,
      msg: "Error al buscar empresas asociadas a un usuario",
      companies: null
    });
  })
}

function readCovers(req: Request, res: Response) {

  const covers: any[] = [
    { name: 'Pizza', filename: 'cover-pizza.jpg' },
    { name: 'Vegan', filename: 'cover-vegan.jpg' },
    { name: 'Cake', filename: 'cover-cake.jpg' },
    { name: 'Coffee', filename: 'cover-coffee.jpg' },
    { name: 'Beer', filename: 'cover-beer.jpg' },
    { name: 'Barbeque', filename: 'cover-barbeque.jpg' },
  ]

  return res.status(200).json({
    ok: true,
    msg: 'Se obtuvieron las imagenes predefinidas correctamente',
    covers
  })

}

function updateCover(req: Request, res: Response) {

  const idCompany = req.body.idCompany;
  const coverFilename = req.body.coverFilename;

  Company.findByIdAndUpdate(idCompany, { tx_company_cover: coverFilename }, { new: true }).then(companyDB => {

    if (!companyDB) {
      return res.status(400).json({
        ok: false,
        msg: 'No existe el comercio para el cual desesa guardar la portada',
        company: null
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'La portada fue actualizada correctamente',
      company: companyDB
    })

  })

}

function updateTheme(req: Request, res: Response) {

  const idCompany = req.body.idCompany;
  const themeFilename = req.body.themeFilename;

  Company.findByIdAndUpdate(idCompany, { tx_theme: themeFilename }, { new: true }).then(companyDB => {

    if (!companyDB) {
      return res.status(400).json({
        ok: false,
        msg: 'No existe el comercio para el cual desesa guardar el tema',
        company: null
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'El tema fue actualizado correctamente',
      company: companyDB
    })

  })

}

function findCompany(req: Request, res: Response) {

  var pattern = String(req.params.pattern);
  var regex = new RegExp(pattern, 'i');

  Company.find({ tx_company_name: regex }).then(companiesDB => {

    if (!companiesDB) {
      return res.status(200).json({
        ok: false,
        msg: "No existe la empresa",
        companies: null
      });
    }

    res.status(200).json({
      ok: true,
      msg: 'Empresa obtenida correctamente',
      companies: companiesDB
    });

  }).catch(() => {
    return res.status(500).json({
      ok: false,
      msg: "Error al buscar el user",
      companies: null
    });
  })
}

function updateCompany(req: Request, res: Response) {

  var body = req.body;

  Company.findByIdAndUpdate(body._id, {

    tx_company_type: body.tx_company_type,
    tx_company_name: body.tx_company_name,
    tx_company_slogan: body.tx_company_slogan,
    tx_company_string: body.tx_company_string,
    tx_company_location: body.tx_company_location,
    cd_company_location: body.cd_company_location,
    tx_company_lat: body.tx_company_lat,
    tx_company_lng: body.tx_company_lng,
    tx_address_street: body.tx_address_street,
    tx_address_number: body.tx_address_number

  }, { new: true }).then(companyDB => {

    if (!companyDB) {
      return res.status(400).json({
        ok: false,
        msg: "No existe la empresa que desea actualizar",
        company: null
      });
    }

    return res.status(200).json({
      ok: true,
      msg: "Empresa actualizada correctamente",
      company: companyDB
    });

  });

}

function updateWebPage(req: Request, res: Response) {

  let idCompany = req.params.idCompany;
  let txWelcome = req.body.txWelcome;
  let txEmail = req.body.txEmail;
  let txTelegram = req.body.txTelegram;
  let txWhatsapp = req.body.txWhatsapp;
  let txFacebook = req.body.txFacebook;
  let txTwitter = req.body.txTwitter;
  let txInstagram = req.body.txInstagram;


  Company.findByIdAndUpdate(idCompany, {
    tx_email: txEmail,
    tx_telegram: txTelegram,
    tx_whatsapp: txWhatsapp,
    tx_facebook: txFacebook,
    tx_twitter: txTwitter,
    tx_instagram: txInstagram,
    tx_company_welcome: txWelcome
  }, { new: true }).then(companyUpdated => {

    if (!companyUpdated) {
      return res.status(400).json({
        ok: false,
        msg: 'Error al actualizar la información del comercio',
        company: null
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'Información del comercio actualizada correctamente',
      company: companyUpdated
    })

  }).catch((err) => {
    return res.status(400).json({
      ok: false,
      msg: { msg: 'Error al actualizar la información del comercio', detail: err },
      company: null
    })
  })
}

function deleteCompany(req: Request, res: Response) {

  var idCompany = req.params.idCompany;

  const sectionsIds = Section.find({ id_company: idCompany }).then(sectionsDB => {

    const sections = sectionsDB.map(section => String(section._id));

    const scoreItemsDeleted = ScoreItem.deleteMany({ id_section: { $in: sections } })
    const tablesDeleted = Table.deleteMany({ id_section: { $in: sections } })
    const sectionsDeleted = Section.deleteMany({ id_company: idCompany })
    const waitersDeleted = User.deleteMany({ id_company: idCompany, id_role: 'WAITER_ROLE' })
    const companyDeleted = Company.findByIdAndDelete(idCompany)

    Promise.all([scoreItemsDeleted, tablesDeleted, sectionsDeleted, waitersDeleted, companyDeleted]).then(resp => {
      return res.status(200).json({
        ok: true,
        msg: 'La empresa y sus vínculos fueron eliminados correctamente',
        company: {
          company: resp[2],
          childs: { users: resp[0], tables: resp[1] }
        }
      });
    }).catch((err) => {
      return res.status(400).json({
        ok: false,
        msg: { msg: 'Error al eliminar la empresa o uno de sus vínculos', detail: err },
        company: null
      });
    });

  });

}

function checkCompanyExists(req: Request, res: Response) {

  let pattern = req.body.pattern;
  Company.findOne({ tx_company_string: pattern }).then(companyDB => {

    if (!companyDB) {
      return res.status(200).json({
        ok: true,
        msg: 'No existe la empresa'
      })
    }

    return res.status(200).json({
      ok: false,
      msg: 'La empresa ya existe.',
      company: companyDB
    })

  }).catch(() => {
    return res.status(500).json({
      ok: false,
      msg: 'Error al consultar si existe la empresa'
    })
  })
}

export = {
  createCompany,
  readCompany,
  readCompanies,
  findCompany,
  updateCompany,
  updateWebPage,
  updateTheme,
  readCovers,
  updateCover,
  deleteCompany,
  checkCompanyExists
}

