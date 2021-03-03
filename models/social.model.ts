//response in the backend
export interface facebookBackendResponse {
    data: {
        app_id: string;
        type: string;
        application: string;
        data_access_expires_at: number;
        expires_at: number;
        is_valid: boolean;
        scopes: string[];
        user_id: string;

    }
}

// response in the client
interface facebookFrontendResponse {
    authResponse: {
      accessToken: string;
      data_access_expiration_time: number;
      expiresIn: number;
      graphDomain: string;
      signedRequest: string;
      userID: string;
    }
    status: string;
  }
  
  export interface Social {
    txPlatform: string;
    txToken: string;
  }