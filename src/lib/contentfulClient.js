import { createClient } from 'contentful';

export const client = createClient({
  // React lukee nämä automaattisesti prosessin taustalta
  space: process.env.REACT_APP_CONTENTFUL_SPACE_ID,
  environment: 'master', 
  accessToken: process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN
});