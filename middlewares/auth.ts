import { Response, Request, NextFunction } from 'express';
import Token from '../classes/token';

let verificaToken = (req: any, res: Response, next: NextFunction) => {

    const userToken = req.get('turnos-token' || '');
    Token.checkToken(userToken)
        .then((decoded: any) => {
            req.usuario = decoded.usuario;
            next(); 
        })
        .catch((err) => {
            res.json({
                ok: false,
                msg: 'Token incorrecto'
            });
        });
};

let canUpdate = (req: any, res: Response, next: NextFunction) => {
 
    var user_request = req.usuario;
    var user_to_update = req.params.id; 
    if (
      user_request.role === "ADMIN_ROLE" ||
      user_request._id === user_to_update
    ) {
      next();
      return;
    } else {
      return res.status(401).json({
        //401 UNAUTHORIZED
        ok: false,
        msg: "Token Incorrecto - el role no es ADMIN_ROLE"
      });
    }
  };

export = {
    verificaToken,
    canUpdate
}