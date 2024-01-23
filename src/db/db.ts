import { Sequelize} from "sequelize";
import  {getSecret} from '../utils/secretsManager';

   
let sequelize:any ='';
(async () => {
    try {
        // Retrieve secrets from AWS Secrets Manager
            let dbSecrets:any ='';
            const reciterPubNotifierSecretLoc = process.env.RECITER_PUB_NOTIFIER_SECRET_LOC || '';
            if(reciterPubNotifierSecretLoc && reciterPubNotifierSecretLoc =='AWS')
            {
                const reciterPubSecretManager = process.env.RECITER_PUB_SECRET_MANAGER || '';
                 dbSecrets = await getSecret( reciterPubSecretManager);
            }
            const { RECITER_DB_NAME,RECITER_DB_USERNAME,RECITER_DB_PASSWORD,RECITER_DB_HOST,RECITER_DB_REGION, RECITER_DB_PORT } = dbSecrets;
            sequelize = new Sequelize(
            RECITER_DB_NAME || process.env.RECITER_DB_NAME || "",
            RECITER_DB_USERNAME || process.env.RECITER_DB_USERNAME || "",
            RECITER_DB_PASSWORD || process.env.RECITER_DB_PASSWORD || "",
            {
                dialect: 'mysql',
                dialectOptions: {
                    connectTimeout: 120000, // 60 seconds
                },
                host: RECITER_DB_HOST || process.env.RECITER_DB_HOST  ,
                port:  RECITER_DB_PORT || 3306,
                pool: {
                    max: 20,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                }
            }
        );
        
    }
    catch (error) {
        console.error('Error initializing Sequelize:', error);
        throw error;
        }
})();
export default sequelize;