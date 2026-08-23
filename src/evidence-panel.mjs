import {readPublicReportFromLocation} from './public-report.mjs';

const initial = readPublicReportFromLocation();
if (initial) queueMicrotask(() => renderEvidencePanel(initial));
window.addEventListener('dc:report-ready', event => renderEvidencePanel(event.detail));

export function renderEvidencePanel(payload) {
  const detail = document.getElementById('detailReport');
  if (!detail) return;
  detail.querySelector('#evidencePanel')?.remove();
  const e = payload?.detail?.evidence || {};
  const analyzed = Number(e.analyzed_repos || payload?.evidence_count || 0);
  const evaluated = Number(e.evaluated_repos || payload?.evaluated_count || 0);
  const coverage = Number(e.coverage || payload?.evidence_coverage || 0);
  const signatures = Array.isArray(e.signatures) ? e.signatures : (payload?.evidence_summary?.signatures || []);
  const tests = Number(e.repos_with_tests || payload?.evidence_summary?.repos_with_tests || 0);
  const ci = Number(e.repos_with_ci || payload?.evidence_summary?.repos_with_ci || 0);
  const architecture = Number(e.strong_architecture_repos || payload?.evidence_summary?.strong_architecture_repos || 0);

  const card = document.createElement('article');
  card.id = 'evidencePanel';
  card.className = 'report-card evidence-card';
  card.innerHTML = `
    <h3>Evidence解析</h3>
    <div class="evidence-coverage"><div><span>実ファイル構造を取得</span><b>${analyzed}/${evaluated} repo</b></div><i><em style="width:${Math.max(2,Math.min(100,coverage))}%"></em></i><small>${Math.round(coverage)}% coverage</small></div>
    <div class="evidence-mini-grid">
      <div><small>test Evidence</small><strong>${tests} repo</strong></div>
      <div><small>CI Evidence</small><strong>${ci} repo</strong></div>
      <div><small>強い構造Signal</small><strong>${architecture} repo</strong></div>
    </div>
    <div class="evidence-signatures"><small>実ファイルから確認した技術シグナル</small><div>${signatures.length ? signatures.map(x=>`<span>${esc(x)}</span>`).join('') : '<span>取得できたシグナルはまだありません</span>'}</div></div>
    <p class="micro">この枠はGitHub recursive treeで実際に取得できたファイル構造Evidenceのみを表示します。未取得repoは能力評価へ偽装しません。</p>`;

  const grid = detail.querySelector('.detail-grid');
  if (grid) grid.insertBefore(card, grid.firstChild?.nextSibling || grid.firstChild);
}

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
