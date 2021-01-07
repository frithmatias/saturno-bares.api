import { Request, Response } from 'express';
import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Settings } from '../models/settings.model';

// ========================================================
// Company Methods
// ========================================================

function createCompany(req: Request, res: Response) {
  // Save Company
  var body = req.body;

  var company = new Company({
    id_user: body.id_user,
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


    let defaultSettings = new Settings({
      id_company: companySaved._id,
      bl_spm_auto: true
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
      return res.status(400).json({
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

    if (!companiesDB) {
      return res.status(200).json({
        ok: false,
        msg: "No existen empresas asociadas al user",
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
      msg: "Error al buscar empresas asociadas a un user",
      companies: null
    });
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
  let txWhatsapp = req.body.txWhatsapp;
  let txFacebook = req.body.txFacebook;
  let txTwitter = req.body.txTwitter;
  let txInstagram = req.body.txInstagram;


  Company.findByIdAndUpdate(idCompany, {
    tx_email: txEmail,
    tx_whatsapp: txWhatsapp,
    tx_facebook: txFacebook,
    tx_twitter: txTwitter,
    tx_instagram: txInstagram,
    tx_company_welcome: txWelcome
  }, { new: true }).then(companyUpdated => {

    if (!companyUpdated) {
      return res.status(400).json({
        ok: false,
        msg: 'Error al actualizar datos secundarios del comercio',
        company: null
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'Datos secundarios del comercio actualizados correctamente',
      company: companyUpdated
    })

  }).catch((err) => {
    return res.status(400).json({
      ok: false,
      msg: { msg: 'Error al actualizar datos secundarios del comercio', detail: err },
      company: null
    })
  })
}

function deleteCompany(req: Request, res: Response) {

  var idCompany = req.params.idCompany;

  let users = User.deleteMany({ id_company: idCompany, id_role: 'ASSISTANT_ROLE' }).then(usersDeleted => usersDeleted)
  let tables = Table.deleteMany({ id_company: idCompany }).then(tablesDeleted => tablesDeleted)
  let sections = Section.deleteMany({ id_company: idCompany }).then(sectionsDeleted => sectionsDeleted)
  let company = Company.findByIdAndDelete(idCompany).then(companyDeleted => companyDeleted)

  Promise.all([users, tables, sections, company]).then(resp => {
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
  deleteCompany,
  checkCompanyExists
}

