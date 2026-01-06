import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';
import {findOrcreateAdminUser,persistUserLogin,grantDefaultRolesToAdminUser,verifyOneTimeToken} from "../../../utils/samlUtils";

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

export const options = {
	debug: true,
      providers: [
    CredentialsProvider({
      id: 'direct_login',
      name: 'ReCiter Publication Manager App',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log("credentials************",credentials);
        if (!credentials?.username || !credentials?.password) return null;

        const user = await authenticate(credentials);
        if (user?.statusCode !== 200) return null;

        const adminUser = await findOrcreateAdminUser(
          credentials.username,
          credentials.email,
          credentials.firstName,
          credentials.lastName
        );

        const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
        const userRoles = await findUserPermissions(credentials.username, 'cwid');

        if (process.env.ASMS_API_BASE_URL)
          persistUserLogin(credentials.username)
          .catch(error => {
                  // Log the error to a system like Sentry, CloudWatch, etc.
                  console.error("Failed to write the login information to ASMS:", error);
                  // The error is now contained and will not crash the process.
                });	

        user.databaseUser = adminUser;
        user.userRoles = userRoles;
        return user;
      },
    }),
    CredentialsProvider({
          id: 'saml',
          name: 'SAML',
          /*credentials: {
            samlResponse: { label: "SAML Response", type: "text" },
            email: { label: "Email", type: "text" },
            csrfToken: { label: "CSRF Token", type: "text" }
          },*/
          async authorize(credentials) {

           try
           { 
            const cookie = req.cookies['saml_bridge'];
            if (!cookie) return null;

            const samlUser = JSON.parse(decrypt(cookie));
            const samlUserEmail = samlUser?.email;
            // Perform your DB calls/checks here as planned
            if(samlUserEmail){
                       // find an adminUser with email and if exists then assign default role(REPORTER_ALL) and selected roles from configuration  
                           const adminUser =  await findOrcreateAdminUser(cwid,smalUserEmail,firstName,lastName)
                           console.log('adminUser****************',adminUser);
                           await sleep(100)
                          if(adminUser){
                                if(cwid && reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                            && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                                if(adminUser)
                                    return adminUser;
                         }
                         else if(cwid)
                         {
                               const adminUser =  await findOrcreateAdminUser(cwid,smalUserEmail,firstName,lastName)
                               if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                        && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                               if(adminUser)
                               {
                                    console.log('finalAdminUser*****************',adminUser);
                                    return adminUser;
                               }
                         }
                         
                    }
                    else if(cwid){
                           const adminUser = await findOrcreateAdminUser(cwid,smalUserEmail,firstName,lastName)
                           if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                    && reciterConfig.asms.userTrackingAPIAuthorization)
                                persistUserLogin(cwid);	
                           if(adminUser)
                           {
                            console.log('finalAdminUser from CWID else if*****************',adminUser);
                                    return adminUser;
                           }
                    }
                    return { cwid, has_access: false };
                } catch (error) {
                    return null;
                }

            
           
            
           // console.log("authorize req:", req);
           // console.log("Incoming CSRF:", req.body.csrfToken);
            //console.log("Cookie CSRF:", req?.cookies["next-auth.csrf-token"]);     
          

           /* console.log("coming into SAML authorize method",credentials,);
            const samlToken = credentials?.samlBody;
            console.log("extracted samlToken",samlToken);
            if (!credentials?.samlBody) {
              return null;
            }*/
            // Verify the temporary token created in the ACS route
           // const userProfile = verifyOneTimeToken(samlToken);
          /* const userProfile = JSON.parse(decodeURIComponent(credentials.samlBody)); 
           console.log("userProfile*********************",userProfile);
            if (userProfile) {
              // This object is what NextAuth will use to create the session
              /* {
                personIdentifier: userProfile?.personIdentifier,
                name:`${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim(),
                email: userProfile?.email,
                userRoles : userProfile.userRoles 
          };*/
          /*const userSessionData = {
              personIdentifier: userProfile?.personIdentifier,
              name: `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim(),
              email: userProfile?.email,
              userRoles: userProfile.userRoles
          };

          // Log it to see the JSON object values
          console.log("userSessionData*********************", JSON.stringify(userSessionData, null, 2));
          //console.log("authorize cookies:", credentials.cookies); 
          // Return it
          return userSessionData;

        }*/

        return null;
      },
          
    }),



  ],

  callbacks: {
    /*async signIn({ user, account, profile, email, credentials  }) {
      console.log('signIn Callback:', user);
      return true;
    },*/

    async jwt({ token, user }) {
      console.log("user is jwt callback*************",user);
      console.log("jwt callback******************",token,user); 
      if (user) console.log("JWT callback: new login for", user.email);
       else console.log("JWT callback: existing token", token);
 
      if (user) {
        token.adminSettings = await fetchUpdatedAdminSettings();
        token.user = user;
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser || null;
        token.userRoles = user.userRoles || [];

        token.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || token.username;;
        token.picture = user.image || user.databaseUser?.profilePicture;
      }
      console.log('returning token**********',token);
      return token;
    },

    async session({ session, token }) {
      console.log("Calling session callback*************");  
      console.log("Session callback:", session.user.email);

      session.data = token;
      session.adminSettings = token.adminSettings;
      console.log("session*******************",session);
      
      session.user.username = token.username;
      session.user.databaseUser = token.databaseUser;
      session.user.userRoles = token.userRoles;
      session.user = token.user;      
      
   console.log('adminSettings***********',session);
      // Don't touch session.user until token is validated
  /*if (!token || !token.email) {
    return session;   // This prevents redirect loops
  }*/

  // Construct a clean user object
  /*session.user = {
        email: token.email || '',
        username: token.username || '',
        name: token.name || token.username,
        userRoles: token.userRoles || [],
        databaseUser: token.databaseUser || null,
  };*/
  session.adminSettings = token.adminSettings|| null;
  // Put the whole token in session.data if you need it
  //session.data = token;
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },
 /* pages: {
    // This tells NextAuth to redirect to your custom handler instead of the default sign-in form
    signIn: '/auth/saml-bridge' 
  },*/

  secret: process.env.NEXTAUTH_SECRET,
};




export default authHandler;

