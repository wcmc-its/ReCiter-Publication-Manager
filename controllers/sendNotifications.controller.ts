
import { Request, Response } from 'express';
const nodemailer = require("nodemailer");
//const smtpTransport = require("nodemailer-smtp-transport");

export async function sendNotification(req) {

    let transporter = nodemailer.createTransport(({//smtpTransport({
        host: 'smtp.med.cornell.edu',
        port: 587,
        secure: true, // true for 465, false for other ports
        logger: true,
        debug: true,
        secureConnection: true,
        auth: {
            user: 'svc_deptdb',
            pass: 'Lv173A201!LMtu8Bvp'
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

