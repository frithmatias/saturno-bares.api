import { Request, Response } from 'express';
import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { Skill } from '../models/skill.model';
import { Desktop } from '../models/desktop.model';

// ========================================================
// Company Methods
// ========================================================

function createCompany(req: Request, res: Response) {
  // Save Company
  var body = req.body;
  var company = new Company({
    id_user: body.company.id_user,
    tx_company_name: body.company.tx_company_name,
    tx_public_name: body.company.tx_public_name,
    tx_address_street: body.company.tx_address_street,
    tx_address_number: body.company.tx_address_number,
    cd_city: body.company.cd_city,
    fc_att_start: null,
    fc_att_end: null
  });

  company.save().then((companySaved) => { 
    
    // create generic skill for this company
    const skill = new Skill();
    skill.id_company = companySaved._id;
    skill.cd_skill = 'T';
    skill.tx_skill = 'ATENCION GENERAL';
    skill.bl_generic = true;

    // create generic desktop for this company 
    const desktop = new Desktop();
    desktop.id_company = companySaved._id;
    desktop.cd_desktop = '1';
    desktop.id_session = null;
    desktop.bl_generic = true;
    

    skill.save().then((skillSaved) => {
      desktop.save().then((desktopSaved) => {
      // push generic skill to previous skills for this user
      User.findByIdAndUpdate(body.company.id_user, {$push: {id_skills: skillSaved._id}}).then((userDB)=>{
              
        return res.status(200).json({
          ok: true,
          msg: 'Empresa creada correctamente',
          company: companySaved
        })

      }).catch(()=> {

        return res.status(400).json({
          ok: true,
          msg: 'Se genero la companía y el skill genérico, pero hubo un error al asignar el skill al usuario',
          company: companySaved
        })

      })

    }).catch((err)=>{
      return res.status(400).json({
        ok: false,
        msg: 'Error al guardar el escritorio por defecto',
        company: null
      })
    })

    }).catch((err)=>{
      return res.status(400).json({
        ok: false,
        msg: 'Error al guardar el skill por defecto',
        company: null
      })
    })

  }).catch((err) => {
    return res.status(400).json({
      ok: false,
      msg: err,
      company: null
    })
  })
}

function readCompany(req: Request, res: Response) {
  var idCompany = String(req.params.idCompany);

  Company.findOne({ tx_public_name: idCompany }).then(companyDB => {

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
      return res.status(400).json({
        ok: false,
        msg: "No existen empresas asociadas al user",
        companies: null
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
    tx_public_name: body.tx_public_name,
    cd_city: body.cd_city,
    tx_address_street: body.tx_address_street,
    tx_address_number: body.tx_address_number
  }).then(companyDB => {

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

function deleteCompany(req: Request, res: Response) {

  var idCompany = req.params.idCompany;

  let users = User.deleteMany({ id_company: idCompany, id_role: 'ASSISTANT_ROLE' }).then(usersDeleted => usersDeleted)
  let skills = Skill.deleteMany({ id_company: idCompany }).then(usersDeleted => usersDeleted)
  let desktops = Desktop.deleteMany({ id_company: idCompany }).then(usersDeleted => usersDeleted)
  let company = Company.findByIdAndDelete(idCompany).then(usersDeleted => usersDeleted)

  Promise.all([users, skills, desktops, company]).then(resp => {
    return res.status(200).json({
      ok: true,
      msg: 'La empresa y sus vínculos fueron eliminados correctamente',
      company: {
        company: resp[3],
        childs: { users: resp[0], skills: resp[1], desktops: resp[2] }
      }
    });
  }).catch(() => {
    return res.status(400).json({
      ok: false,
      msg: 'Error al eliminar la empresa o uno de sus vínculos'
    });
  });
}

function checkCompanyExists(req: Request, res: Response) {

  let pattern = req.body.pattern;
  Company.findOne({ tx_public_name: pattern }).then(companyDB => {

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
  deleteCompany,
  checkCompanyExists
}

