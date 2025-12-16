// 秒数を "MM:SS" 形式に変換
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 現在のタブ情報を取得
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Content Scriptから動画情報を取得
async function getVideoInfo() {
  try {
    const tab = await getCurrentTab();
    
    // YouTubeの動画ページかチェック
    if (!tab.url || !tab.url.includes('youtube.com/watch')) {
      throw new Error('YouTube動画ページを開いてください');
    }

    // Content Scriptにメッセージを送信
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
    
    if (!response || response.error) {
      throw new Error(response?.error || '動画情報の取得に失敗しました');
    }

    return response;
  } catch (error) {
    throw error;
  }
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

// UIを更新
function updateUI(videoTitle, currentTime) {
  document.getElementById('videoTitle').textContent = videoTitle || '-';
  document.getElementById('currentTime').textContent = formatTime(currentTime);
}

// ステータスメッセージを表示
function showStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = isError ? 'status error' : 'status success';
  
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }, 3000);
}

// 初期化
async function init() {
  try {
    // 動画情報を取得
    const videoInfo = await getVideoInfo();
    updateUI(videoInfo.videoTitle, videoInfo.currentTime);

    // 保存ボタンのイベントリスナー
    document.getElementById('saveButton').addEventListener('click', async () => {
      const noteText = document.getElementById('noteText').value.trim();
      
      if (!noteText) {
        showStatus('メモ内容を入力してください', true);
        return;
      }

      try {
        await saveNote(
          videoInfo.videoId,
          videoInfo.videoTitle,
          videoInfo.currentTime,
          noteText
        );
        
        // テキストエリアをクリア
        document.getElementById('noteText').value = '';
        showStatus('メモを保存しました！');
        
        // Content Scriptに更新を通知
        const tab = await getCurrentTab();
        chrome.tabs.sendMessage(tab.id, { action: 'refreshNotes' });
      } catch (error) {
        showStatus('保存に失敗しました: ' + error.message, true);
      }
    });
  } catch (error) {
    showStatus(error.message, true);
    document.getElementById('saveButton').disabled = true;
  }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);

