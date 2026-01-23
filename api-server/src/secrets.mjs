import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'eu-west-2' });

export async function loadSecrets() {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: 'prsm/api-server/config' })
    );
    const secrets = JSON.parse(response.SecretString);
    
    // Load into environment variables
    Object.keys(secrets).forEach(key => {
      process.env[key] = secrets[key];
    });
    
     return secrets;
  } catch (error) {
    console.error('Error loading secrets:', error);
    throw error;
  }
}