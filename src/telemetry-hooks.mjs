import {trackFunnel, initTelemetryDashboard, shouldTrackCreatorFunnel} from './telemetry.mjs';

const dashboardMode = initTelemetryDashboard();

if (!dashboardMode && shouldTrackCreatorFunnel()) {
  trackFunnel('page_view');

  window.addEventListener('dc:report-ready', () => trackFunnel('generate_success'));

  const status = document.getElementById('status');
  if (status) {
    const observeStatus = () => classifyStatus(String(status.textContent || ''));
    const observer = new MutationObserver(observeStatus);
    observer.observe(status, {childList:true, subtree:true, characterData:true});
    observeStatus();
  }
}

function classifyStatus(text) {
  if (/件の公開repoを取得しました/.test(text)) trackFunnel('github_loaded');
  if (/Evidence解析完了:/.test(text)) trackFunnel('generate_success');
  if (/共有シートから「画像を保存」|正本Xカード（1200×675 PNG）を書き出しました/.test(text)) trackFunnel('card_saved');
  if (/X投稿文と詳細レポートURLをコピーしました/.test(text)) trackFunnel('post_text_copied');
}
