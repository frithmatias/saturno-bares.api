import { Request, Response } from 'express';
import { Company } from '../models/company.model';
import { Contact } from '../models/contact.model';
import { ScoreItem } from '../models/scoreitem.model';
import { Score } from '../models/score.model';
import { Location } from '../models/location.model';

function getClientData(req: Request, res: Response) {
  var company = String(req.params.company);

  Company.findOne({ tx_company_name: company }).then(companyDB => {

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

function postContact(req: Request, res: Response) {

  let contact = new Contact();
  contact.tx_type = req.body.tx_type;
  contact.tx_message = req.body.tx_message;
  contact.tx_name = req.body.tx_name;
  contact.tx_email = req.body.tx_email;
  contact.tx_phone = req.body.tx_phone;

  contact.save().then(contactSaved => {
    return res.status(200).json({
      ok: true,
      msg: 'Contacto guardado correctamente',
      contact: contactSaved._id
    })
  }).catch(() => {
    return res.status(400).json({
      ok: false,
      msg: 'Error al guardar el contacto',
      contact: null
    })
  })


}

function getScoreItems(req: Request, res: Response) {
  let idSection = req.params.idSection;

  ScoreItem.find({ id_section: idSection }).then(itemsToScore => {
    if (itemsToScore.length === 0) {
      return res.status(200).json({
        ok: false,
        msg: 'No existen items para calificar en este sector',
        scoreitems: []
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'Se encontraron items para calificar en el sector indicado',
      scoreitems: itemsToScore
    })
  })

}

function postScores(req: Request, res: Response) {

  let scores = req.body;
  Score.insertMany(scores).then(scoresSaved => {
    if (!scoresSaved) {
      return res.status(400).json({
        ok: false,
        msg: 'No se pudieron guardar las calificaciones',
        scores: null
      })
    }

    return res.status(200).json({
      ok: true,
      msg: 'Las calificaciones fueron guardadas con éxito',
      scores: scoresSaved
    })

  })

  // contact.tx_type = req.body.tx_type;
  // contact.tx_message = req.body.tx_message;
  // contact.tx_name = req.body.tx_name;
  // contact.tx_email = req.body.tx_email;
  // contact.tx_phone = req.body.tx_phone;

  // contact.save().then(contactSaved => {
  //   return res.status(200).json({
  //     ok: true,
  //     msg: 'Contacto guardado correctamente',
  //     contact: contactSaved._id
  //   })
  // }).catch(() => {
  //   return res.status(400).json({
  //     ok: false,
  //     msg: 'Error al guardar el contacto',
  //     contact: null
  //   })
  // })


}

function readLocations(req: Request, res: Response) {
  var pattern = req.params.pattern;
  var regex = new RegExp(pattern, 'i');

  if (pattern.length != 3) {
    return;
  } else {
    Location.find({})
      .or([
        { 'properties.provincia.nombre': regex },
        { 'properties.departamento.nombre': regex },
        { 'properties.nombre': regex }
      ])
      .exec((err, locations) => {

        if (err) {
          return res.status(400).json({
            ok: false,
            msg: 'Error al obtener las localidades',
            locations: null
          })
        } else {
          return res.status(200).json({
            ok: true,
            msg: 'Localidades obtenidas correctamente',
            locations
          })
        }
      });
  }



}
export = {
  getClientData,
  postContact,
  getScoreItems,
  postScores,
  readLocations
}

