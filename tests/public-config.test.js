import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAuthConfig} from '../lib/visitor-auth.js';
test('only public Supabase keys can be sent to the browser',()=>{
  process.env.SUPABASE_URL='https://example.supabase.co';
  for(const key of ['', 'sb_secret_private', 'x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.y']) {
    process.env.SUPABASE_ANON_KEY=key; assert.throws(publicAuthConfig);
  }
  process.env.SUPABASE_ANON_KEY='sb_publishable_public'; assert.equal(publicAuthConfig().key,'sb_publishable_public');
});
