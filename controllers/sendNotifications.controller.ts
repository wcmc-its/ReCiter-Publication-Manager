
import { Request, Response } from 'express';
import NodeMailer from "nodemailer";


export async function sendNotification(req,res) {
    if (req.method !== "POST") {
        res.status(404).send({ message: "only post request allowed" });
        return;
    }

    if (!req.body.message || req.body.message.length === 0) {
         res.status(400).send({ error: "bad Request" });
         return;
     }

    let transporter = NodeMailer.createTransport(({
        host: process.env.SMTP_HOST_NAME,
        port: process.env.NODE_ENV === "production" ? 465 : 25,
        secure: process.env.NODE_ENV === "production" ? true : false, 
        logger: true,
        debug: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        tls:{
            rejectUnAuthorized: process.env.NODE_ENV === "production" ? true : false,
        }
    }));

    const fromAddress =
        process.env.NODE_ENV === "production"
            ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
            : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>';

    // setup email data with unicode symbols
    let mailOptions = {
        from: fromAddress,
        to: process.env.SMTP_ADMIN_EMAIL, // admin_users.email
        subject: req.body.subject,
        text: req.body.message,
        html: `<div>${req.body.message}</div><p>Sent from:
        ${req.body.email}</p>`
        
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.log(err);
        } else {
            console.log(info, "email sent");
        }
        res.status(200).json({ success: true });
    });
}

