import NodeMailer from "nodemailer";


export function sendEmailNotification(mailOptions) {

  let dbSecrets ='';
  (async () => {
    try {
          const reciterPubNotifierSecretLoc = process.env.RECITER_PUB_NOTIFIER_SECRET_LOC || '';
          if(reciterPubNotifierSecretLoc && reciterPubNotifierSecretLoc =='AWS')
          {
                const reciterPubSecretManager = process.env.RECITER_PUB_SECRET_MANAGER || '';
                dbSecrets = await getSecret(reciterPubSecretManager);
          }
          const { SMTP_HOST_NAME,SMTP_ADMIN_EMAIL,SMTP_PASSWORD,SMTP_USER,SMTP_PORT, SMTP_SECURE } = dbSecrets;
        }
        catch (error) {
            console.error('Error initializing Sequelize:', error);
            throw error;
            }
    })();        
  return new Promise((resolve,reject)=>{
    let transporter = NodeMailer.createTransport(({
      host: dbSecrets.SMTP_HOST_NAME || process.env.SMTP_HOST_NAME,
      port: process.env.NODE_ENV === "production" ? dbSecrets.SMTP_PORT : 25,
      secure: process.env.NODE_ENV === "production" ? dbSecrets.SMTP_SECURE : false,
      logger: true,
      debug: true,
      auth: {
        user: dbSecrets.SMTP_USER || process.env.SMTP_USER,
        pass: dbSecrets.SMTP_PASSWORD || process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnAuthorized: process.env.NODE_ENV === "production" ? true : false,
      }
    }))
      transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
          console.log("error is "+err);
          resolve(false); 
        } 
        else {
            console.log('Email sent: ' + info.response);
            resolve(true);
        }
    });
    
  });
}