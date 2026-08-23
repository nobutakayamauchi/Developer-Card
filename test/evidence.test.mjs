import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTree} from '../src/evidence.mjs';
import {AUTH, normalizeRepo, diagnose} from '../src/diagnosis.mjs';
import {buildDeveloperCardReportV1} from '../src/public-report.mjs';

test('recursive tree yields structural Evidence without reading code bodies', () => {
  const tree = [
    {type:'blob',path:'package.json',size:1200},
    {type:'blob',path:'next.config.mjs',size:300},
    {type:'blob',path:'src/app/page.tsx',size:4200},
    {type:'blob',path:'src/lib/api.ts',size:2200},
    {type:'blob',path:'tests/app.test.ts',size:1800},
    {type:'blob',path:'.github/workflows/test.yml',size:900},
    {type:'blob',path:'README.md',size:3200},
    {type:'blob',path:'Dockerfile',size:500}
  ];
  const ev = analyzeTree(tree);
  assert.equal(ev.available, true);
  assert.equal(ev.file_count, 8);
  assert.ok(ev.source_file_count >= 3);
  assert.ok(ev.test_file_count >= 1);
  assert.equal(ev.workflow_file_count, 1);
  assert.ok(ev.signatures.includes('Next.js'));
  assert.ok(ev.signatures.includes('Docker'));
  assert.ok(ev.architecture_score > 40);
});

test('diagnosis reports actual Evidence coverage and uses evidence-aware recommendation reasons', () => {
  const base = normalizeRepo({full_name:'u/app',name:'app',html_url:'https://github.com/u/app',language:'TypeScript',size:1200,updated_at:new Date().toISOString(),default_branch:'main'});
  base.authorization = AUTH.SHOWCASE_AND_EVALUATE;
  base.evidence = analyzeTree([
    {type:'blob',path:'package.json',size:1000},
    {type:'blob',path:'src/app.ts',size:5000},
    {type:'blob',path:'tests/app.test.ts',size:1200},
    {type:'blob',path:'.github/workflows/test.yml',size:600},
    {type:'blob',path:'Dockerfile',size:400}
  ]);
  const second = normalizeRepo({full_name:'u/tool',name:'tool',html_url:'https://github.com/u/tool',language:'Python',size:500,updated_at:new Date().toISOString(),default_branch:'main'});
  second.authorization = AUTH.SHOWCASE_AND_EVALUATE;
  const result = diagnose([base, second]);
  assert.equal(result.evidence_count, 1);
  assert.equal(result.evidence_coverage, 50);
  assert.ok(result.highlights.some(x => /実ファイル構造Evidenceを1\/2/.test(x)));
  assert.equal(result.recommended[0].evidence_available, true);
});

test('machine report preserves aggregate Evidence but not arbitrary runtime evidence objects', () => {
  const report = buildDeveloperCardReportV1({
    handle:'u', github_user:'u', type:'システム構築型',
    evidence_count:4, evidence_coverage:80,
    evidence_summary:{signatures:['Docker','GitHub Actions'],strong_architecture_repos:2,repos_with_tests:3,repos_with_ci:2,secret:'drop'},
    recommended:[],
    detail:{evidence:{analyzed_repos:4,evaluated_repos:5,coverage:80,signatures:['Docker'],repos_with_tests:3,repos_with_ci:2,strong_architecture_repos:2,raw_tree:['secret']}}
  });
  assert.equal(report.evidence_count, 4);
  assert.equal(report.evidence_coverage, 80);
  assert.deepEqual(report.evidence_summary.signatures, ['Docker','GitHub Actions']);
  assert.equal('secret' in report.evidence_summary, false);
  assert.equal('raw_tree' in report.detail.evidence, false);
});
