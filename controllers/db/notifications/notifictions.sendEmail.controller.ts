
import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import NodeMailer from "nodemailer";
import Handlebars from "handlebars";
import models from '../../../src/db/sequelize'


export const sendEmail = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  let apiBody  = req.body;

  try {
    const generateEmailNotifications: any = await sequelize.query(
      "CALL generateEmailNotifications (:personIdentier , :email )",
      {
        replacements: { personIdentier: apiBody.personIdentifier?apiBody.personIdentifier:'', email: apiBody.emailOverride?apiBody.emailOverride:'' },
        raw: true,
      }
    );
	
    sendNotification(generateEmailNotifications,req,res);
										 
	// return generateEmailNotifications;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}



export async function sendNotification(emailData,req,res) {
  const originLocation = req?.headers?.origin;//window.location.origin;
  const notificationsLink = originLocation + '/notifications';
  
  const fromAddress =
    process.env.NODE_ENV === "production"
      ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
      : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>';

  emailData.map((emailDetails) => {
    let { admin_user_id,sender,recipient, subject,salutation, accepted_subject_headline,accepted_publications,suggested_subject_headline,suggested_publications,signature,max_accepted_publication_to_display,max_suggested_publication_to_display,personIdentifier,accepted_pub_count,suggested_pub_count,accepted_publication_det,suggested_publication_det } = JSON.parse(JSON.stringify(emailDetails))
    const personIdentifierProfileLink = originLocation + '/curate/' + personIdentifier;
    let acceptedPublicationArray = accepted_publications && accepted_publications.indexOf('~!,') > -1 ? accepted_publications.split('~!,') : accepted_publications.split('~!');
    let suggestedPublicationArray = suggested_publications && suggested_publications.indexOf('~!,') > -1 ? suggested_publications.split('~!,'): suggested_publications.split('~!');
    console.log("recipient*********************", recipient)
    
    const emailNotificationTemplate = `<div><p>{{salutation}},</p>
                   <p>{{acceptedSubjectHeadline}}</p>
                   <p>{{#each_limit acceptedPublicationArray maxAcceptedPublicationToDisplay}}
                        <ul style="margin-bottom: 0 !important; padding-bottom:0 !important; margin:0">
                            <li style="margin-bottom: 0; padding:0" >{{this}}</li>
                        </ul>
                   {{/each_limit}}</p>
                  <p><li>{{#seeAllLink acceptedPubCount maxAcceptedPublicationToDisplay "See all" personIdentifierProfileLink 'ACCEPTED'}}{{/seeAllLink}}</li></p>
                  <p>{{suggestedSubjectHeadline}}</p>
                  <p>{{#each_limit suggestedPublicationArray maxSuggestedPublicationToDisplay}}
                       <ul style="margin-bottom: 0; padding:0">
                            <li style='list-style-position: inside'>{{this}}</li>
                       </ul
                   {{/each_limit}}</p>
                  <p><li>{{#seeAllLink suggestedPubCount maxSuggestedPublicationToDisplay "See all" personIdentifierProfileLink 'SUGGESTED'}}{{/seeAllLink}}</li></p> 
                  <p>To update your notification preferences, navigate to the {{link "Notifications" notificationsLink}} page.
                  <pre><span style="color:#00000; font-size:13px; font-weight:400; font-family: Arial, Helvetica, sans-serif !important" >{{signature}}</span></pre>
                  </p></div>`;

    var template = Handlebars.compile(emailNotificationTemplate);
        var replacements = {
            salutation : salutation,
            acceptedSubjectHeadline : accepted_subject_headline,
            acceptedPublicationArray : acceptedPublicationArray,
            suggestedSubjectHeadline: suggested_subject_headline,
            suggestedPublicationArray : suggestedPublicationArray,
            signature : signature,
            maxAcceptedPublicationToDisplay:max_accepted_publication_to_display,
            maxSuggestedPublicationToDisplay:max_suggested_publication_to_display,
            acceptedPubCount : accepted_pub_count,
            suggestedPubCount : suggested_pub_count,
            notificationsLink : notificationsLink,
            personIdentifierProfileLink : personIdentifierProfileLink
        };
        var emailBody = template(replacements);     

    
    let mailOptions = {
      from: sender || fromAddress,
      to:  process.env.SMTP_ADMIN_EMAIL, // admin_users.email || recipient  to: recipient,
      subject: subject,
      html: emailBody
    }
    console.log('HOST NAME:*********************',process.env.SMTP_HOST_NAME);
    console.log('NODE_ENV:*********************',process.env.NODE_ENV);
    console.log('SMTP_USER:*********************',process.env.SMTP_USER);
    console.log('SMTP_PASSWORD:*********************',process.env.SMTP_PASSWORD);
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
      tls: {
        rejectUnAuthorized: process.env.NODE_ENV === "production" ? true : false,
      }
    }))

    // saveNotificationsLog(admin_user_id,recipient,accepted_publication_det,suggested_publication_det,req,res)
    
    // comment for testing
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
         console.log(err);
       } else {
        saveNotificationsLog(admin_user_id,recipient,accepted_publication_det,suggested_publication_det,req,res)
       }
     res.status(200).json({ success: true });
     });
  }
  );
}

export async function saveNotificationsLog (admin_user_id,recipient,accepted_publication_det,suggested_publication_det,req,res) {
  const { frequency, accepted, status, minimumThreshold, userId } = req.body;
  try {
    let acceptAndSuggestPubs = [];

    accepted_publication_det && JSON.parse(accepted_publication_det)  && JSON.parse(accepted_publication_det).length > 0 && JSON.parse(accepted_publication_det).map((pub)=>{
    let obj = {
          'messageID': frequency,
          'articleIdentifier': pub.PMID,
          'articleScore': pub.totalArticleScoreStandardized,
          'email': recipient, 
          'userID': admin_user_id,
          'dateSent': new Date(),
          'createTimestamp': new Date()
    }
    acceptAndSuggestPubs.push(obj)
    }
    )

    suggested_publication_det && JSON.parse(suggested_publication_det) && JSON.parse(suggested_publication_det).length > 0 && JSON.parse(suggested_publication_det).map((pub)=>{
      let obj = {
            'messageID': frequency,
            'articleIdentifier': pub.PMID,
            'articleScore': pub.totalArticleScoreStandardized,
            'email': recipient, 
            'userID': admin_user_id,
            'dateSent': new Date(),
            'createTimestamp': new Date()
      }
      acceptAndSuggestPubs.push(obj)
      }
      )
      const result = await sequelize.transaction(async (t) => {
          const saveNotificationResp = await models.AdminNotificationLog.bulkCreate(acceptAndSuggestPubs, { transaction: t })
      });
  } catch (e) {
      console.log(e);
      res.status(500).send(e);
  }
}

Handlebars.registerHelper('each_limit', function(ary, max, options) {
  if(!ary || ary.length == 0 || ary=='')
      return options.inverse(this);

  var result = [];
  for(var i = 0; i < max && i < ary.length; ++i)
  {
      result.push(options.fn(ary[i]));
  }
  return result.length > 0?result.join(''):'';
});
Handlebars.registerHelper('seeAllLink', function(v1, v2, text, url,assertion) {
  if(v1 > v2) {
    //url = url + "?userAssertion ='"+assertion +"'";
    //url = url + "/"+assertion;
    let url1 = Handlebars.escapeExpression(url),
      text1 = Handlebars.escapeExpression(text);
      console.log('redirectUrl*************************',url1);
      return new Handlebars.SafeString("<a href='" + url1 +"' style='text-decoration:none' " + "target='_blank'>" + text1 +"</a>"); 
  }
  //return '';
});

Handlebars.registerHelper("link", function(text, url) {
  let url1 = Handlebars.escapeExpression(url),
      text1 = Handlebars.escapeExpression(text)
      
 return new Handlebars.SafeString("<a href='" + url1 + "' style='text-decoration:none' "+" target='_blank'>" + text1 +"</a>");
});



