// Muutetaan require -> import muotoon
import { createClient } from 'contentful';

export const client = createClient({
  space: 'rchue37o185a',
  environment: 'master', 
  accessToken: '31nl_9mUTjwjflgqU3JUUem28Y7Niw6OkABjY2tEPZA'
});