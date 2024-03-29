
import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import NodeMailer from "nodemailer";
import Handlebars, { Exception } from "handlebars";
import models from '../../../src/db/sequelize';
import { sendEmailNotification } from "./../../../src/utils/emailUtilityHelper";



export const sendPubEmailNotifications = async (
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
    let smtpHostName = process.env.SMTP_HOST_NAME || '';
    let smtpUserName = process.env.SMTP_USER || '';
    let smtpPassword = process.env.SMTP_PASSWORD|| '';  
    if(generateEmailNotifications.length > 0 && smtpHostName && smtpUserName && smtpPassword){
      res.status(200).send(await processPubNotification(generateEmailNotifications,req,res));
      }else{
        let noData = {
          message: "Could not find any notifications"
        }
        res.send(noData)
      }
										 
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}


export async function processPubNotification(pubDetails,req,res) {
  const originLocation = req?.headers?.origin;
  
  
  const fromAddress =
    process.env.NODE_ENV === "production"
      ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
      : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>';
  let noConfiguredNotifPersonIdentifiers = [];
  let noEligiblePubNotifPersonIdentifiers = [];
  let successEmailNotifPersonIdentifiers =[];
  const data = pubDetails.map(async (pubRec) => {
    let { admin_user_id,sender,recipient,subject,salutation, accepted_subject_headline,accepted_publications,suggested_subject_headline,suggested_publications,signature,max_accepted_publication_to_display,max_suggested_publication_to_display,personIdentifier,accepted_pub_count,suggested_pub_count,accepted_publication_det,suggested_publication_det,pub_error_message, notif_error_message,max_message_id } = JSON.parse(JSON.stringify(pubRec))
   
    if(pub_error_message)
    {
      noEligiblePubNotifPersonIdentifiers.push(personIdentifier)
    }else if(notif_error_message)
    {
      noConfiguredNotifPersonIdentifiers.push(personIdentifier)
    }else
    {
      const personIdentifierProfileLink = originLocation + '/curate/' + personIdentifier;
      const navigateToCurateSelfPage = originLocation + '/curate/' + personIdentifier ;
      let acceptedPublicationArray = accepted_publications && accepted_publications.indexOf('~!,') > -1 ? accepted_publications.split('~!,') : accepted_publications.split('~!');
      let suggestedPublicationArray = suggested_publications && suggested_publications.indexOf('~!,') > -1 ? suggested_publications.split('~!,'): suggested_publications.split('~!');
      const notificationsLink = originLocation + '/notifications/' + personIdentifier;

      const emailNotificationTemplate = `<div style="font-family: Arial; font-size : 11pt"><p>{{salutation}},</p>
                    <p>{{acceptedSubjectHeadline}}</p>
                    <div>{{#each_limit acceptedPublicationArray maxAcceptedPublicationToDisplay}}
                          <ul style="margin-bottom: 0 !important; padding-bottom:0 !important; margin:0">
                              <li style="margin-bottom: 0 !important; padding:0 0 1em 0 !important" >{{this}}</li>
                          </ul>
                    {{/each_limit}}</div>
                    <p>{{suggestedSubjectHeadline}}</p>
                    <div>{{#each_limit suggestedPublicationArray maxSuggestedPublicationToDisplay}}
                        <ul style="margin-bottom: 0 !important; padding-bottom:0 !important; margin:0">
                              <li style="margin-bottom: 0 !important; padding:0 0 1em 0 !important">{{this}}</li>
                        </ul>
                    {{/each_limit}}</div>
                    <p><b>Review and update:</b> {{seeMore acceptedPubCount suggestedPubCount personIdentifierProfileLink 'ACCEPTED' 'SUGGESTED' navigateToCurateSelfPage }}. To update your notification preferences, navigate to the Notifications tab.
                    <pre><span style="color:#00000; font-family: Arial; font-size : 11pt !important" >{{signature}}</span></pre>
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
              personIdentifierProfileLink : personIdentifierProfileLink,
              navigateToCurateSelfPage : navigateToCurateSelfPage
          };
          var emailBody = template(replacements);     
      
      let mailOptions = {
        from: sender || fromAddress,
        to: recipient, // admin_users.email || recipient  to: 
        subject: subject,
        html: emailBody
      }
      let emailInfo = await sendEmailNotification(mailOptions) //{

        if(emailInfo && personIdentifier)
        {
            successEmailNotifPersonIdentifiers.push(personIdentifier);
            //calling upon sending successful email notifications
            saveNotificationsLog(admin_user_id, recipient, accepted_publication_det, suggested_publication_det, req, res,max_message_id)
    
        }
  }
});

    const emailNotificationDetails = await Promise.all(data);
     //Preparing an object for the messages
     if(emailNotificationDetails)
     {
        let emailNotificationPubMsgDetails = 
        {
          "noConfiguredNotificationMsg": noConfiguredNotifPersonIdentifiers && noConfiguredNotifPersonIdentifiers.length > 0 ? `No email has been sent for ${noConfiguredNotifPersonIdentifiers.join()} due to no notifications configured.`:'',
          "noEligiblePubNotifMsg": noEligiblePubNotifPersonIdentifiers && noEligiblePubNotifPersonIdentifiers.length > 0 ? `No email has been sent for ${noEligiblePubNotifPersonIdentifiers.join()} due to no eligible publications.`:'',
          "successEmailNotifMsg": successEmailNotifPersonIdentifiers && successEmailNotifPersonIdentifiers.length > 0 ? `Email for ${successEmailNotifPersonIdentifiers.join()} sent to` :'' 
        }
        return emailNotificationPubMsgDetails;
      }
 }


export async function saveNotificationsLog (admin_user_id,recipient,accepted_publication_det,suggested_publication_det,req,res,max_message_id) {
  const { frequency, accepted, status, minimumThreshold, userId } = req.body;
  try {
    let acceptAndSuggestPubs = [];
    if(!accepted_publication_det) console.error('Unable to save Notification log due to missing accepted publication details',admin_user_id);  

    accepted_publication_det && JSON.parse(accepted_publication_det)  && JSON.parse(accepted_publication_det).length > 0 && JSON.parse(accepted_publication_det).map((pub)=>{
    let obj = {
          'messageID': max_message_id +1,
          'pmid': pub.PMID,
          'articleScore': pub.totalArticleScoreStandardized,
          'email': recipient, 
          'userID': admin_user_id,
          'dateSent': new Date(),
          'createTimestamp': new Date(),
          'notificationType': 'Accepted'
          
    }
      acceptAndSuggestPubs.push(obj)
    }
    )

    if(!suggested_publication_det) console.error('Unable to save Notification log due to missing accepted publication details',admin_user_id);

    suggested_publication_det && JSON.parse(suggested_publication_det) && JSON.parse(suggested_publication_det).length > 0 && JSON.parse(suggested_publication_det).map((pub)=>{
      let obj = {
            'messageID': max_message_id +1,
            'pmid': pub.PMID,
            'articleScore': pub.totalArticleScoreStandardized,
            'email': recipient, 
            'userID': admin_user_id,
            'dateSent': new Date(),
            'createTimestamp': new Date(),
            'notificationType':'Suggested'
      }
        acceptAndSuggestPubs.push(obj)
      }
      )
      const result = await sequelize.transaction(async (t) => {
          return await models.AdminNotificationLog.bulkCreate(acceptAndSuggestPubs, { transaction: t })
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
    let url1 = Handlebars.escapeExpression(url),
      text1 = Handlebars.escapeExpression(text);
      return new Handlebars.SafeString("<a href='" + url1 +"' style='text-decoration:none; font-size: 11pt' " + "target='_blank'>" + text1 +"</a>"); 
  }
});

Handlebars.registerHelper("link", function(text, url) {
  let url1 = Handlebars.escapeExpression(url),
      text1 = Handlebars.escapeExpression(text)
      
 return new Handlebars.SafeString("<a href='" + url1 + "' style='text-decoration:none' "+" target='_blank'>" + text1 +"</a>");
});

Handlebars.registerHelper("seeMore", function(acceptedPubCount, suggestedPubCount, personIdentifierProfileLink, accepetedText, suggestedText,navigateToCurateSelfPage ) {
  let acceptedPubCount1 = Handlebars.escapeExpression(acceptedPubCount),
      suggestedPubCount1 = Handlebars.escapeExpression(suggestedPubCount),
      personIdentifierProfileLink1 = Handlebars.escapeExpression(personIdentifierProfileLink),
      accepetedText1 = Handlebars.escapeExpression(accepetedText),
      suggestedText1 = Handlebars.escapeExpression(suggestedText),
      navigateToCurateSelfPage1 = Handlebars.escapeExpression(navigateToCurateSelfPage)

      if(acceptedPubCount1  && suggestedPubCount1){
        return new Handlebars.SafeString("There are currently "+ suggestedPubCount1 +" pending and "+ acceptedPubCount1 +" newly accepted publications linked to <a href='" + navigateToCurateSelfPage1 + "' style='text-decoration:none; font-size: 11pt' "+" target='_blank'> your profile</a>") 
      }else if(!acceptedPubCount1  && suggestedPubCount1){
        return new Handlebars.SafeString("There are currently "+ suggestedPubCount1 +" pending publications linked to <a href='" + personIdentifierProfileLink1 + "' style='text-decoration:none; font-size: 11pt' "+" target='_blank'> your profile</a>") 
      }else if(acceptedPubCount1  && !suggestedPubCount1){
        return new Handlebars.SafeString("There are currently "+ acceptedPubCount1 +" newly accepted publications linked to <a href='" + personIdentifierProfileLink1 + "' style='text-decoration:none; font-size: 11pt' "+" target='_blank'> your profile</a>") 
      }
});



