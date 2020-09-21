let env = process.env.NODE_ENV || 'desar';
let environment: any;

if (env === 'desar') {
	var desar = require('./environment.desar');
	environment = {
		URL_SERVICES: desar.environment.URL_SERVICES,
		TOKEN_SEED: desar.environment.TOKEN_SEED,
		TOKEN_TIMEOUT: desar.environment.TOKEN_TIMEOUT,
		GOOGLE_CLIENT_ID: desar.environment.GOOGLE_CLIENT_ID,
		GOOGLE_SECRET: desar.environment.GOOGLE_SECRET,
		DB_CONN_STR: desar.environment.DB_CONN_STR,
		MAILER_USER: desar.environment.MAILER_USER,
		MAILER_PASS: desar.environment.MAILER_PASS,
		FTP_HOST: desar.environment.FTP_HOST,
		FTP_USER: desar.environment.FTP_USER,
		FTP_PASS: desar.environment.FTP_PASS,
		SERVER_PORT: desar.environment.SERVER_PORT
	};
} else {
	environment = {
		URL_SERVICES: process.env.URL_SERVICES,
		TOKEN_SEED: process.env.TOKEN_SEED,
		TOKEN_TIMEOUT: process.env.TOKEN_TIMEOUT,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_SECRET: process.env.GOOGLE_SECRET,
		DB_CONN_STR: process.env.DB_CONN_STR,
		MAILER_USER: process.env.MAILER_USER,
		MAILER_PASS: process.env.MAILER_PASS,
		FTP_HOST: process.env.FTP_HOST,
		FTP_USER: process.env.FTP_USER,
		FTP_PASS: process.env.FTP_PASS,
		SERVER_PORT: process.env.PORT
	};
}

export default environment;