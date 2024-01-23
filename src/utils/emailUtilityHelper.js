import NodeMailer from "nodemailer";


export function sendEmailNotification(mailOptions) {
  return new Promise((resolve,reject)=>{
    let transporter = NodeMailer.createTransport(({
      host: process.env.SMTP_HOST_NAME,
      port: process.env.NODE_ENV === "production" ? process.env.SMTP_PORT : 25,
      secure: process.env.NODE_ENV === "production" ? process.env.SMTP_SECURE : false,
      logger: true,
      debug: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnAuthorized: process.env.NODE_ENV === "production" ? process.env.SMTP_SECURE : false,
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