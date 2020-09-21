import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import CompanyController from '../controllers/company.controller';

// ROUTES
const companyRoutes = Router();

companyRoutes.post('/create', mdAuth.verificaToken, CompanyController.createCompany);
companyRoutes.post('/update', mdAuth.verificaToken, CompanyController.updateCompany);
companyRoutes.get('/readcompanies/:idUser', CompanyController.readCompanies);
companyRoutes.get('/readcompany/:idCompany', CompanyController.readCompany);
companyRoutes.get('/findcompany/:pattern', CompanyController.findCompany);
companyRoutes.post('/checkcompanyexists', CompanyController.checkCompanyExists);
companyRoutes.delete('/deletecompany/:idCompany', CompanyController.deleteCompany);


export default companyRoutes;