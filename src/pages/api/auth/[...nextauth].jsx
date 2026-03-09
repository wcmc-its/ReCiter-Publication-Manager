import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {findOrcreateAdminUser,persistUserLogin,grantDefaultRolesToAdminUser,verifyOneTimeToken} from "../../../utils/samlUtils";
import { decrypt } from "../saml/crypto";
import { reciterConfig } from "../../../../config/local";

const authHandler = async (req, res) => {
    console.log('NextAuth handler called - Method:', req.method, 'URL:', req.url);
    await NextAuth(req, res, options);
};

const sleep = ms => new Promise(res => setTimeout(res, ms));

export const authOptions = {
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
        console.log('Direct login authorize called with username:', credentials?.username);
        if (!credentials?.username || !credentials?.password) return null;

        const user = await authenticate(credentials);
        console.log('Direct login authenticate result:', user?.statusCode);
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
          credentials: {},
          /*credentials: {
            samlResponse: { label: "SAML Response", type: "text" },
            email: { label: "Email", type: "text" },
            csrfToken: { label: "CSRF Token", type: "text" }
          },*/
          async authorize(credentials,req) {
            console.log('SAML authorize called - headers cookie exists:', !!req.headers?.cookie);
            console.log('coming to authorize method to validate the user****');
           try
           { 
            const cookieHeader = req.headers?.cookie;
            console.log('SAML cookieHeader length:', cookieHeader?.length);
            if (!cookieHeader) return null;
           const bridgeCookie = cookieHeader
                                          .split(';')
                                          .find(c => c.trim().startsWith('saml_bridge='))
                                          ?.split('=')[1];
            console.log('SAML bridgeCookie found:', !!bridgeCookie);

            const samlUser = JSON.parse(decrypt(decodeURIComponent(bridgeCookie)));
            console.log("samlUser in authorize method read from cookie", samlUser);                                
            const samlUserEmail = samlUser?.email;
            const cwid = samlUser?.personIdentifier;
            const firstName = samlUser?.firstName;
            const lastName = samlUser?.lastName;
            console.log('SAML extracted data - email:', !!samlUserEmail, 'cwid:', !!cwid, 'firstName:', !!firstName, 'lastName:', !!lastName);
            
            // Perform your DB calls/checks here as planned
            if(samlUserEmail){
                       console.log('SAML processing with email path');
                       // find an adminUser with email and if exists then assign default role(REPORTER_ALL) and selected roles from configuration  
                           const adminUser =  await findOrcreateAdminUser(cwid,samlUserEmail,firstName,lastName)
                           console.log('SAML adminUser created (email path):', !!adminUser);
                           await sleep(100)
                          if(adminUser){
                                console.log('SAML adminUser exists, returning user');
                                if(cwid && reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                            && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                                if(adminUser)
                                    return adminUser;
                             }
                         else if(cwid)
                         {
                               console.log('SAML processing with cwid fallback');
                               const adminUser =  await findOrcreateAdminUser(cwid,samlUserEmail,firstName,lastName)
                               console.log('SAML adminUser created (cwid fallback):', !!adminUser);
                               if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                        && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                               if(adminUser)
                               {
                                    return adminUser;
                               }
                         }
                         
                    }
                    else if(cwid){
                           console.log('SAML processing with cwid only path');
                           const adminUser = await findOrcreateAdminUser(cwid,samlUserEmail,firstName,lastName)
                           console.log('SAML adminUser created (cwid only):', !!adminUser);
                           if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                    && reciterConfig.asms.userTrackingAPIAuthorization)
                                persistUserLogin(cwid);	
                           if(adminUser)
                           {
                            console.log('finalAdminUser from CWID else if*****************',adminUser);
                                   return adminUser;
 
                           }
                    }
                    console.log('SAML returning access denied object');
                    return { cwid, has_access: false };
                } catch (error) {
                    console.log('SAML authorize error:', error.message);
                    return null;
                }
       return null;
      },
          
    }),



  ],

  callbacks: {
    async jwt({ token, user }) {
      console.log('JWT callback - user exists:', !!user, 'token exists:', !!token);
      if (user) console.log("JWT callback: new login for", user.email);
       else console.log("JWT callback: existing token", token);
 
      if (user) {
        token.user = user;
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser || null;
        token.userRoles = user.userRoles || [];

        token.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || token.username;;
        token.picture = user.image || user.databaseUser?.profilePicture;
        console.log('JWT callback - final token created with username:', token.username);
      }
      return token;
    },

    async session({ session, token }) {
      console.log('Session callback - token username:', token?.username, 'userRoles length:', token?.userRoles?.length);

      session.data = token;
      
      session.user.username = token.username;
      session.user.databaseUser = token.databaseUser;
      session.user.userRoles = token.userRoles;
      session.user = token.user;      
      console.log('Session callback - final session created for user:', session.user?.username);
      
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },
 
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
//export default authHandler;

