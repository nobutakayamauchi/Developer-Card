import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTH, normalizeRepo, diagnose, extractGitHubUser, scoreRepo} from '../src/diagnosis.mjs';

const now = Date.parse('2026-08-23T00:00:00Z');
const repo = (name, extra={}) => normalizeRepo({name,full_name:`u/${name}`,html_url:`https://github.com/u/${name}`,updated_at:'2026-08-20T00:00:00Z',size:500,stargazers_count:0,forks_count:0,open_issues_count:0,fork:false,archived:false,description:'test repo',language:'JavaScript',...extra});

test('extracts GitHub username safely',()=>{
  assert.equal(extractGitHubUser('octocat'),'octocat');
  assert.equal(extractGitHubUser('https://github.com/octocat?tab=repositories'),'octocat');
  assert.equal(extractGitHubUser('https://example.com/octocat'),'');
});

test('EXCLUDE is never scored or counted',()=>{
  const a=repo('a'); const b=repo('secret'); b.authorization=AUTH.EXCLUDE;
  const result=diagnose([a,b],now);
  assert.equal(result.evaluated_count,1);
  assert.equal(scoreRepo(b,now),null);
  assert.ok(!result.recommended.some(x=>x.name==='secret'));
});

test('EVALUATE_ONLY can affect diagnosis but is not recommended publicly',()=>{
  const a=repo('show'); const b=repo('private-signal',{language:'Python',size:900}); b.authorization=AUTH.EVALUATE_ONLY;
  const result=diagnose([a,b],now);
  assert.equal(result.evaluated_count,2);
  assert.equal(result.showcase_count,1);
  assert.deepEqual(result.recommended.map(x=>x.name),['show']);
});

test('no authorized repos fails closed',()=>{
  const a=repo('a'); a.authorization=AUTH.EXCLUDE;
  assert.throws(()=>diagnose([a],now),/NO_AUTHORIZED_REPOSITORIES/);
});

test('stars alone cannot dominate showcase score',()=>{
  const stale=repo('viral',{stargazers_count:100000,updated_at:'2019-01-01T00:00:00Z',size:10,description:''});
  const current=repo('current',{stargazers_count:0,updated_at:'2026-08-22T00:00:00Z',size:800});
  assert.ok(scoreRepo(current,now).showcase > scoreRepo(stale,now).showcase);
});

test('fork is penalized relative to original evidence',()=>{
  const original=repo('original'); const fork=repo('fork',{fork:true});
  assert.ok(scoreRepo(original,now).showcase > scoreRepo(fork,now).showcase);
});
