// 動画IDをURLから抽出
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// 動画要素を取得
function getVideoElement() {
  return document.querySelector('video');
}

// メモリストのコンテナを作成
function createNotesContainer() {
  // 既存のコンテナがあれば削除
  const existing = document.getElementById('yt-notes-container');
  if (existing) {
    existing.remove();
  }

  const container = document.createElement('div');
  container.id = 'yt-notes-container';
  container.className = 'yt-notes-container';
  
  // 動画プレーヤーの下、説明欄の上に挿入
  // YouTubeの構造に合わせて複数のセレクタを試行
  let insertTarget = null;
  
  // 方法1: ytd-watch-metadata（動画情報セクション）の前に挿入（推奨）
  // ただし、SVG要素内でないことを確認
  insertTarget = document.querySelector('ytd-watch-metadata');
  
  if (insertTarget && !isInsideSVG(insertTarget)) {
    insertTarget.insertAdjacentElement('beforebegin', container);
    return container;
  }
  
  // 方法2: #primary-inner または #columns 内で、プレーヤーの後に挿入
  insertTarget = document.querySelector('#primary-inner, #columns');
  
  if (insertTarget && !isInsideSVG(insertTarget)) {
    // プレーヤー要素を探す（ytd-player または #player）
    const player = insertTarget.querySelector('ytd-player, #player, #movie_player');
    if (player && !isInsideSVG(player)) {
      // プレーヤーの親要素を取得
      const playerParent = player.parentElement;
      if (playerParent && playerParent.tagName !== 'DEFS' && playerParent.tagName !== 'SVG') {
        player.insertAdjacentElement('afterend', container);
        return container;
      }
    }
    
    // プレーヤーが見つからない場合、ytd-watch-metadata の前に挿入
    const metadata = insertTarget.querySelector('ytd-watch-metadata');
    if (metadata && !isInsideSVG(metadata)) {
      metadata.insertAdjacentElement('beforebegin', container);
      return container;
    }
    
    // 最初の有効な子要素の後に挿入
    let child = insertTarget.firstElementChild;
    while (child) {
      if (!isInsideSVG(child) && child.tagName !== 'DEFS' && child.tagName !== 'SVG') {
        child.insertAdjacentElement('afterend', container);
        return container;
      }
      child = child.nextElementSibling;
    }
  }
  
  // 方法3: #secondary（サイドバー）の前、メインコンテンツエリアに挿入
  insertTarget = document.querySelector('#secondary, #related');
  
  if (insertTarget && !isInsideSVG(insertTarget)) {
    insertTarget.insertAdjacentElement('beforebegin', container);
    return container;
  }
  
  // フォールバック: #primary の最初の有効な子要素の後に挿入
  insertTarget = document.querySelector('#primary');
  if (insertTarget && !isInsideSVG(insertTarget)) {
    let child = insertTarget.firstElementChild;
    while (child) {
      if (!isInsideSVG(child) && child.tagName !== 'DEFS' && child.tagName !== 'SVG') {
        child.insertAdjacentElement('afterend', container);
        return container;
      }
      child = child.nextElementSibling;
    }
  }
  
  // 最終フォールバック: bodyの先頭に追加（SVG要素を避ける）
  let bodyChild = document.body.firstElementChild;
  while (bodyChild) {
    if (!isInsideSVG(bodyChild) && bodyChild.tagName !== 'DEFS' && bodyChild.tagName !== 'SVG') {
      bodyChild.insertAdjacentElement('beforebegin', container);
      return container;
    }
    bodyChild = bodyChild.nextElementSibling;
  }
  
  // それでも見つからない場合は、bodyの最後に追加
  document.body.appendChild(container);
  return container;
}

// SVG要素内かどうかをチェック
function isInsideSVG(element) {
  if (!element) return false;
  let current = element;
  while (current && current !== document.body) {
    if (current.tagName === 'SVG' || current.tagName === 'DEFS') {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

// メモリストを描画
async function renderNotes() {
  const videoId = getVideoId();
  if (!videoId) return;

  try {
    // ストレージからメモを取得
    const result = await chrome.storage.local.get(videoId);
    const videoData = result[videoId];

    const container = createNotesContainer();

    if (!videoData || !videoData.notes || videoData.notes.length === 0) {
      // 空のメッセージとメモ追加ボタン
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'yt-notes-empty';
      emptyDiv.innerHTML = '<p>メモがありません。</p>';
      
      const addButtonEmpty = document.createElement('button');
      addButtonEmpty.className = 'yt-notes-add-button';
      addButtonEmpty.textContent = '＋ メモ追加';
      addButtonEmpty.style.marginTop = '6px';
      addButtonEmpty.addEventListener('click', () => {
        showAddNoteForm(container);
      });
      
      emptyDiv.appendChild(addButtonEmpty);
      container.appendChild(emptyDiv);
      return;
    }

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'yt-notes-header';
    
    // タイトルと折り畳みボタン
    const headerContent = document.createElement('div');
    headerContent.className = 'yt-notes-header-content';
    
    const title = document.createElement('h3');
    title.textContent = `📝 メモ一覧 (${videoData.notes.length}件)`;
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'yt-notes-toggle';
    toggleButton.setAttribute('aria-label', '折り畳み');
    toggleButton.innerHTML = '▼';
    toggleButton.addEventListener('click', () => {
      const list = container.querySelector('.yt-notes-list');
      const isCollapsed = list.style.display === 'none';
      list.style.display = isCollapsed ? 'flex' : 'none';
      toggleButton.innerHTML = isCollapsed ? '▼' : '▶';
      toggleButton.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    });
    
    headerContent.appendChild(title);
    headerContent.appendChild(toggleButton);
    
    // メモ追加ボタン
    const addButton = document.createElement('button');
    addButton.className = 'yt-notes-add-button';
    addButton.textContent = '＋ メモ追加';
    addButton.setAttribute('aria-label', 'メモを追加');
    addButton.addEventListener('click', () => {
      showAddNoteForm(container);
    });
    
    header.appendChild(headerContent);
    header.appendChild(addButton);
    container.appendChild(header);

    // メモリスト
    const notesList = document.createElement('div');
    notesList.className = 'yt-notes-list';

    videoData.notes.forEach((note, index) => {
      const noteItem = document.createElement('div');
      noteItem.className = 'yt-notes-item';
      
      const timestamp = document.createElement('button');
      timestamp.className = 'yt-notes-timestamp';
      timestamp.textContent = note.timestamp_text || formatTime(note.time);
      timestamp.addEventListener('click', () => {
        jumpToTime(note.time);
      });

      const text = document.createElement('div');
      text.className = 'yt-notes-text';
      text.textContent = note.text;

      const deleteButton = document.createElement('button');
      deleteButton.className = 'yt-notes-delete';
      deleteButton.innerHTML = '×';
      deleteButton.setAttribute('aria-label', 'メモを削除');
      deleteButton.title = 'メモを削除';
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // イベントの伝播を防ぐ
        if (confirm('このメモを削除しますか？')) {
          await deleteNote(videoId, index);
          // メモ一覧を再描画
          renderNotes();
        }
      });

      noteItem.appendChild(timestamp);
      noteItem.appendChild(text);
      noteItem.appendChild(deleteButton);
      notesList.appendChild(noteItem);
    });

    container.appendChild(notesList);
  } catch (error) {
    // エラーは静かに処理
  }
}

// 指定した時間にジャンプ
function jumpToTime(seconds) {
  const video = getVideoElement();
  if (video) {
    video.currentTime = seconds;
    // 視覚的フィードバック
    const container = document.getElementById('yt-notes-container');
    if (container) {
      container.classList.add('jumping');
      setTimeout(() => {
        container.classList.remove('jumping');
      }, 500);
    }
  }
}

// 秒数を "MM:SS" 形式に変換
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}


// メモ追加フォームを表示
function showAddNoteForm(container) {
  // 既存のフォームがあれば削除
  const existingForm = container.querySelector('.yt-notes-add-form');
  if (existingForm) {
    existingForm.remove();
    return;
  }

  const video = getVideoElement();
  const videoId = getVideoId();
  const videoTitle = document.title.replace(' - YouTube', '').trim();
  
  if (!video || !videoId) {
    alert('動画情報を取得できませんでした。ページをリロードしてください。');
    return;
  }

  const currentTime = video.currentTime;
  const timeText = formatTime(currentTime);

  // フォームを作成
  const form = document.createElement('div');
  form.className = 'yt-notes-add-form';
  
  const formHeader = document.createElement('div');
  formHeader.className = 'yt-notes-form-header';
  formHeader.innerHTML = '<h4>📝 メモを追加</h4>';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'yt-notes-form-close';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', '閉じる');
  closeButton.addEventListener('click', () => {
    form.remove();
  });
  formHeader.appendChild(closeButton);
  
  const formInfo = document.createElement('div');
  formInfo.className = 'yt-notes-form-info';
  formInfo.innerHTML = `
    <div class="yt-notes-form-info-item">
      <span class="label">現在時刻:</span>
      <span class="value">${timeText}</span>
    </div>
  `;
  
  const textarea = document.createElement('textarea');
  textarea.className = 'yt-notes-form-textarea';
  textarea.placeholder = 'メモ内容を入力してください...';
  textarea.rows = 2;
  
  const formActions = document.createElement('div');
  formActions.className = 'yt-notes-form-actions';
  
  const saveButton = document.createElement('button');
  saveButton.className = 'yt-notes-form-save';
  saveButton.textContent = '💾 保存';
  saveButton.addEventListener('click', async () => {
    const noteText = textarea.value.trim();
    if (!noteText) {
      alert('メモ内容を入力してください');
      return;
    }
    
    saveButton.disabled = true;
    saveButton.textContent = '保存中...';
    
    try {
      await saveNote(videoId, videoTitle, currentTime, noteText);
      form.remove();
      // メモ一覧を再描画
      renderNotes();
    } catch (error) {
      alert('メモの保存に失敗しました: ' + error.message);
      saveButton.disabled = false;
      saveButton.textContent = '💾 保存';
    }
  });
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'yt-notes-form-cancel';
  cancelButton.textContent = 'キャンセル';
  cancelButton.addEventListener('click', () => {
    form.remove();
  });
  
  formActions.appendChild(saveButton);
  formActions.appendChild(cancelButton);
  
  form.appendChild(formHeader);
  form.appendChild(formInfo);
  form.appendChild(textarea);
  form.appendChild(formActions);
  
  // メモ一覧の前に挿入
  const notesList = container.querySelector('.yt-notes-list, .yt-notes-empty');
  if (notesList) {
    notesList.insertAdjacentElement('beforebegin', form);
  } else {
    container.appendChild(form);
  }
  
  // テキストエリアにフォーカス
  setTimeout(() => {
    textarea.focus();
  }, 100);
}

// メモを保存
async function saveNote(videoId, videoTitle, currentTime, noteText) {
  try {
    // ストレージから既存のデータを取得
    const result = await chrome.storage.local.get(videoId);
    const existingData = result[videoId] || { title: videoTitle, notes: [] };

    // 新しいメモを作成
    const newNote = {
      time: currentTime,
      text: noteText,
      timestamp_text: formatTime(currentTime),
      createdAt: Date.now()
    };

    // メモを追加（時間順にソート）
    existingData.notes.push(newNote);
    existingData.notes.sort((a, b) => a.time - b.time);
    existingData.title = videoTitle; // タイトルを更新

    // ストレージに保存
    await chrome.storage.local.set({ [videoId]: existingData });

    return true;
  } catch (error) {
    throw error;
  }
}

// メモを削除
async function deleteNote(videoId, noteIndex) {
  try {
    // ストレージから既存のデータを取得
    const result = await chrome.storage.local.get(videoId);
    const existingData = result[videoId];

    if (!existingData || !existingData.notes || !existingData.notes[noteIndex]) {
      throw new Error('削除するメモが見つかりません');
    }

    // メモを削除
    existingData.notes.splice(noteIndex, 1);

    // メモが0件になった場合、動画データを削除
    if (existingData.notes.length === 0) {
      await chrome.storage.local.remove(videoId);
    } else {
      // ストレージに保存
      await chrome.storage.local.set({ [videoId]: existingData });
    }

    return true;
  } catch (error) {
    throw error;
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    const video = getVideoElement();
    const videoId = getVideoId();
    
    if (!video || !videoId) {
      sendResponse({ error: '動画が見つかりません' });
      return;
    }

    const videoTitle = document.title.replace(' - YouTube', '').trim();
    
    sendResponse({
      videoId: videoId,
      currentTime: video.currentTime,
      videoTitle: videoTitle
    });
  } else if (request.action === 'refreshNotes') {
    renderNotes();
    sendResponse({ success: true });
  }
  
  return true; // 非同期レスポンスのため
});

// ページ読み込み時と動画変更時にメモを表示
function initContentScript() {
  // YouTubeの動的コンテンツ読み込みを待つ（複数回試行）
  let attempts = 0;
  const maxAttempts = 10;
  let lastVideoId = null;
  
  const tryRender = () => {
    attempts++;
    const videoId = getVideoId();
    const video = getVideoElement();
    
    if (videoId && video) {
      // 動画IDが変更された場合のみ再描画
      if (videoId !== lastVideoId) {
        lastVideoId = videoId;
        renderNotes();
      }
    } else if (attempts < maxAttempts) {
      setTimeout(tryRender, 500);
    }
  };
  
  // 初回描画
  setTimeout(tryRender, 500);

  // URL変更を監視（SPAのため）
  let lastUrl = location.href;
  const checkUrlChange = () => {
    const url = location.href;
    const videoId = getVideoId();
    
    if (url !== lastUrl && url.includes('/watch')) {
      lastUrl = url;
      lastVideoId = null; // 動画IDをリセットして強制的に再描画
      attempts = 0;
      setTimeout(tryRender, 500);
    } else if (url.includes('/watch')) {
      // URLが同じでも動画IDが変更されている可能性がある
      if (videoId && videoId !== lastVideoId) {
        lastVideoId = null;
        attempts = 0;
        setTimeout(tryRender, 500);
      }
    }
  };

  // MutationObserverでURL変更を監視
  new MutationObserver(checkUrlChange).observe(document, { subtree: true, childList: true });
  
  // popstateイベント（ブラウザの戻る/進むボタン）を監視
  window.addEventListener('popstate', () => {
    lastVideoId = null;
    lastUrl = location.href;
    attempts = 0;
    setTimeout(tryRender, 500);
  });
  
  // pushState/replaceStateを監視（YouTubeの内部ナビゲーション）
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(checkUrlChange, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkUrlChange, 100);
  };
  
  // 定期的に動画IDをチェック（フォールバック）
  setInterval(() => {
    const currentVideoId = getVideoId();
    if (currentVideoId && currentVideoId !== lastVideoId && location.href.includes('/watch')) {
      lastVideoId = null;
      attempts = 0;
      setTimeout(tryRender, 500);
    }
  }, 2000);
}

// 初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

