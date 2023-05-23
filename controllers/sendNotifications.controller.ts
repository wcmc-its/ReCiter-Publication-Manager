
import { Request, Response } from 'express';
const nodemailer = require("nodemailer");
//const smtpTransport = require("nodemailer-smtp-transport");

export async function sendNotification(req) {

    let transporter = nodemailer.createTransport(({//smtpTransport({
        host: process.env.SMTP_HOST_NAME,
        port: process.env.SMTP_PORT_NUMBER,
        secure: true, 
        logger: true,
        debug: true,
        secureConnection: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        tls:{
            rejectUnAuthorized:true,
            // ciphers: "SSLv3"  
        }
    }));
    // setup email data with unicode symbols
    let mailOptions = {
        from: 'veenkatesh.mca@gmail.com', // sender address
        // to: toEmail, // list of receivers
        bcc: "manikya442@gmail.com",
        subject: "test email", // Subject line
        text: "It is working", // plain text body
        // html: body, // html body

        // dsn: {
        //     id: 'some random message specific id',
        //     return: 'headers',
        //     notify: ['failure', 'delay', 'success'],
        //     recipient: 'info@fankick.io'
        // }
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
    });
}

