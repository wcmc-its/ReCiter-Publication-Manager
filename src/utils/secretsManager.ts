// secretsManager.ts
//import { SecretsManager } from 'aws-sdk';
import  SecretsManager  from 'aws-sdk/clients/secretsmanager';
const secretsManager = new SecretsManager();

export async function getSecret(secretName: string): Promise<any> {

  if(!secretName)
  {
        console.error('AWS SecretManager variable (RECITER_PUB_SECRET_MANAGER) is missing as Lambda function environment variables',secretName) 
        return; 
  } 
 const params = {
    SecretId: secretName,
  };
  try {
    const data = await secretsManager.getSecretValue(params).promise();
    return JSON.parse(data.SecretString || '{}');
  } catch (error) {
    console.error('Error retrieving secret:', error);
    throw error;
  }
}
