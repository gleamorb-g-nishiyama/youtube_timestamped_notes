// 秒数を "MM:SS" 形式に変換
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 全てのメモを取得
async function getAllNotes() {
  try {
    const allData = await chrome.storage.local.get(null);
    const notes = [];

    // 各動画のメモをフラット化
    for (const [videoId, videoData] of Object.entries(allData)) {
      if (videoData && videoData.notes && Array.isArray(videoData.notes)) {
        videoData.notes.forEach(note => {
          notes.push({
            videoId: videoId,
            videoTitle: videoData.title || 'タイトル不明',
            time: note.time,
            text: note.text,
            timestamp_text: note.timestamp_text || formatTime(note.time),
            createdAt: note.createdAt || 0
          });
        });
      }
    }

    // 作成日時でソート（新しい順）
    notes.sort((a, b) => b.createdAt - a.createdAt);

    return notes;
  } catch (error) {
    return [];
  }
}

// 動画にジャンプ
function jumpToVideo(videoId, time) {
  const url = `https://www.youtube.com/watch?v=${videoId}&t=${time}s`;
  chrome.tabs.create({ url: url });
}

// メモ一覧を描画
function renderNotes(notes) {
  const container = document.getElementById('notesContainer');
  const loading = document.getElementById('loading');
  const empty = document.getElementById('empty');

  loading.style.display = 'none';

  if (notes.length === 0) {
    empty.style.display = 'block';
    container.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  container.style.display = 'block';

  // 動画ごとにグループ化
  const groupedByVideo = {};
  notes.forEach(note => {
    if (!groupedByVideo[note.videoId]) {
      groupedByVideo[note.videoId] = {
        title: note.videoTitle,
        notes: []
      };
    }
    groupedByVideo[note.videoId].notes.push(note);
  });

  // HTMLを生成
  let html = '';

  for (const [videoId, videoData] of Object.entries(groupedByVideo)) {
    // 動画ごとのセクション
    html += `
      <div class="video-section">
        <div class="video-header">
          <h2 class="video-title">${escapeHtml(videoData.title)}</h2>
          <span class="video-count">${videoData.notes.length}件のメモ</span>
        </div>
        <div class="video-notes">
    `;

    // メモを時間順にソート
    videoData.notes.sort((a, b) => a.time - b.time);

    videoData.notes.forEach(note => {
      html += `
        <div class="note-item">
          <button class="note-timestamp" data-video-id="${escapeHtml(videoId)}" data-time="${note.time}">
            ${escapeHtml(note.timestamp_text)}
          </button>
          <div class="note-text">${escapeHtml(note.text)}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // タイムスタンプボタンのイベントリスナー
  container.querySelectorAll('.note-timestamp').forEach(button => {
    button.addEventListener('click', () => {
      const videoId = button.getAttribute('data-video-id');
      const time = parseInt(button.getAttribute('data-time'), 10);
      jumpToVideo(videoId, time);
    });
  });
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 初期化
async function init() {
  const notes = await getAllNotes();
  renderNotes(notes);

  // ストレージ変更を監視して自動更新
  chrome.storage.onChanged.addListener(() => {
    getAllNotes().then(notes => {
      renderNotes(notes);
    });
  });
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);

