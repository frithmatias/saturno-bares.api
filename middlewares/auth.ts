import { Response, Request, NextFunction } from 'express';
import Token from '../classes/token';

let verificaToken = (req: any, res: Response, next: NextFunction) => {

    const userToken = req.get('turnos-token' || '');
    console.log(userToken)
    Token.checkToken(userToken).then((decoded: any) => {
            req.usuario = decoded.payload.newUser;
            next(); 
        })
        .catch((err) => {
            res.status(401).json({
                ok: false,
                msg: 'La sesión expiró. Volvé a loguearte.',
                code: 1001
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
        msg: "No tiene los permisos necesarios."
      });
    }
  };

export = {
    verificaToken,
    canUpdate
}