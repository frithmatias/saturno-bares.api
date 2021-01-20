let env = process.env.NODE_ENV;
let environment: any;
if (env === 'produ') {
	environment = {
		TOKEN_TELEGRAM: process.env.TOKEN_TELEGRAM,
		TOKEN_SEED: process.env.TOKEN_SEED,
		TOKEN_TIMEOUT: process.env.TOKEN_TIMEOUT,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		MONGO_DB: process.env.MONGO_DB,
		MAILER_USER: process.env.MAILER_USER,
		MAILER_PASS: process.env.MAILER_PASS,
		FTP_HOST: process.env.FTP_HOST,
		FTP_USER: process.env.FTP_USER,
		FTP_PASS: process.env.FTP_PASS,
		SERVER_PORT: process.env.PORT
	
	};
} else {
	var desar = require('./environment');
	environment = {
		TOKEN_TELEGRAM: desar.environment.TOKEN_TELEGRAM,
		TOKEN_SEED: desar.environment.TOKEN_SEED,
		TOKEN_TIMEOUT: desar.environment.TOKEN_TIMEOUT,
		GOOGLE_CLIENT_ID: desar.environment.GOOGLE_CLIENT_ID,
		MONGO_DB: desar.environment.MONGO_DB,
		MAILER_USER: desar.environment.MAILER_USER,
		MAILER_PASS: desar.environment.MAILER_PASS,
		FTP_HOST: desar.environment.FTP_HOST,
		FTP_USER: desar.environment.FTP_USER,
		FTP_PASS: desar.environment.FTP_PASS,
		SERVER_PORT: desar.environment.SERVER_PORT
	};
}

export default environment;