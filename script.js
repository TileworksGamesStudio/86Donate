/**
 * CONNECTIONS ENGINE CONTROLLER
 * Architecture:
 * - Single source of truth: puzzles.csv
 * - HTTP Date header validation mapped to Europe/London timezone
 * - No local clock fallbacks or file pickers
 * - Strict Past/Current/Future release partitioning
 */

(function () {
  'use strict';

  // 1. CONFIGURATION
  const CONFIG = {
    puzzleCsvPath: './puzzles.csv',
    releaseTimeZone: 'Europe/London',
    maxMistakes: 4,
    storageKey: 'COCKTAIL_CONNECTIONS_SAVE_V3',
    soundKey: 'COCKTAIL_PLATFORM_SOUND_V2',
    categoryColors: { yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪' }
  };

  // 2. CENTRAL APPLICATION STATE
  const APP_STATE = {
    ukDate: null,          // YYYY-MM-DD
    currentRelease: null,  // Today's exact puzzle
    vaultReleases: [],     // All past puzzles
    isReady: false
  };

  // 3. UTILITIES
  async function fetchAuthoritativeDate() {
    try {
      const url = window.location.href.split('#')[0].split('?')[0];
      const cacheBuster = `?_t=${Date.now()}`;
      const response = await fetch(url + cacheBuster, { method: 'GET', cache: 'no-store' });
      const dateHeader = response.headers.get('Date');
      if (!dateHeader) throw new Error("Missing Date header");
      
      const absoluteTime = new Date(dateHeader);
      if (isNaN(absoluteTime.getTime())) throw new Error("Invalid Date header");

      // Extract Europe/London date reliably
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: CONFIG.releaseTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(absoluteTime);
      const y = parts.find(p => p.type === 'year').value;
      const m = parts.find(p => p.type === 'month').value;
      const d = parts.find(p => p.type === 'day').value;
      
      return `${y}-${m}-${d}`;
    } catch (error) {
      console.error("Time authority failure:", error);
      return null;
    }
  }

  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentCell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n' || char === '\r') {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c !== '')) rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          if (char === '\r' && text[i + 1] === '\n') i++;
        } else {
          currentCell += char;
        }
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }
    return rows;
  }

  function mapRowToGameData(row, headers) {
    const getVal = (colName) => {
      const idx = headers.indexOf(colName);
      return idx > -1 ? row[idx] : '';
    };

    const dateStr = getVal('release_date');
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return null;

    return {
      release_date: dateStr,
      id: getVal('id'),
      title: getVal('title'),
      difficulty: getVal('difficulty'),
      categories: [
        {
          name: getVal('cat1_name'),
          difficulty: getVal('cat1_diff'),
          items: [getVal('cat1_1'), getVal('cat1_2'), getVal('cat1_3'), getVal('cat1_4')]
        },
        {
          name: getVal('cat2_name'),
          difficulty: getVal('cat2_diff'),
          items: [getVal('cat2_1'), getVal('cat2_2'), getVal('cat2_3'), getVal('cat2_4')]
        },
        {
          name: getVal('cat3_name'),
          difficulty: getVal('cat3_diff'),
          items: [getVal('cat3_1'), getVal('cat3_2'), getVal('cat3_3'), getVal('cat3_4')]
        },
        {
          name: getVal('cat4_name'),
          difficulty: getVal('cat4_diff'),
          items: [getVal('cat4_1'), getVal('cat4_2'), getVal('cat4_3'), getVal('cat4_4')]
        }
      ]
    };
  }

  // 4. AUDIO ENGINE
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = localStorage.getItem(CONFIG.soundKey) !== 'false';
    }
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem(CONFIG.soundKey, this.enabled ? 'true' : 'false');
      return this.enabled;
    }
    playTone(freq, type, duration, vol) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
    playTap() { this.playTone(880, 'sine', 0.05, 0.08); }
    playDeselect() { this.playTone(440, 'sine', 0.05, 0.06); }
    playError() { this.playTone(140, 'sawtooth', 0.2, 0.15); }
    playSuccess() {
      if (!this.enabled) return;
      this.init();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.15), idx * 70);
      });
    }
  }

  // 5. STORAGE MANAGER
  class StorageManager {
    constructor() {
      this.state = this.load();
    }
    load() {
      try {
        const raw = localStorage.getItem(CONFIG.storageKey);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { stats: { played: 0, won: 0, currentStreak: 0, maxStreak: 0, zeroMistakes: 0 }, games: {} };
    }
    save() {
      try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.state)); } catch (e) {}
    }
    getGameState(id) { return this.state.games[id] || null; }
    setGameState(id, data) { this.state.games[id] = data; this.save(); }
    recordWin(mistakesLeft) {
      this.state.stats.played++;
      this.state.stats.won++;
      this.state.stats.currentStreak++;
      if (this.state.stats.currentStreak > this.state.stats.maxStreak) {
        this.state.stats.maxStreak = this.state.stats.currentStreak;
      }
      if (mistakesLeft === CONFIG.maxMistakes) this.state.stats.zeroMistakes++;
      this.save();
    }
    recordLoss() {
      this.state.stats.played++;
      this.state.stats.currentStreak = 0;
      this.save();
    }
  }

  // 6. MAIN APPLICATION
  class Application {
    constructor() {
      this.sound = new SoundEngine();
      this.storage = new StorageManager();
      
      this.activePuzzle = null;
      this.selectedWords = [];
      this.unsolvedTiles = [];
      this.solvedCategories = [];
      this.mistakesRemaining = CONFIG.maxMistakes;
      this.guessHistory = [];
      this.isComplete = false;
      this.isVaultPlay = false;

      this.cacheDOM();
      this.bindEvents();
      this.init();
    }

    cacheDOM() {
      this.dom = {
        screenLoading: document.getElementById('screen-loading'),
        loadingStatusText: document.getElementById('loading-status-text'),
        btnRetryInit: document.getElementById('btn-retry-init'),
        
        screenMenu: document.getElementById('screen-menu'),
        menuDayPill: document.getElementById('menu-day-pill'),
        menuDiffPill: document.getElementById('menu-diff-pill'),
        menuPuzzleTitle: document.getElementById('menu-puzzle-title'),
        menuStatusText: document.getElementById('menu-status-text'),
        btnPlayToday: document.getElementById('btn-play-today'),
        btnPlayTodayText: document.getElementById('btn-play-today-text'),
        
        btnMenuVault: document.getElementById('btn-menu-vault'),
        btnMenuStats: document.getElementById('btn-menu-stats'),
        btnMenuHelp: document.getElementById('btn-menu-help'),
        btnMenuSound: document.getElementById('btn-menu-sound'),
        menuSoundText: document.getElementById('menu-sound-text'),
        
        screenGame: document.getElementById('screen-game'),
        btnBackToMenu: document.getElementById('btn-back-to-menu'),
        btnGameSound: document.getElementById('btn-game-sound'),
        puzzleDateLabel: document.getElementById('puzzle-date-label'),
        puzzleDifficulty: document.getElementById('puzzle-difficulty'),
        gridContainer: document.getElementById('grid-container'),
        solvedStack: document.getElementById('solved-categories-stack'),
        mistakeIndicators: document.getElementById('mistake-indicators'),
        
        btnShuffle: document.getElementById('btn-shuffle'),
        btnDeselect: document.getElementById('btn-deselect'),
        btnSubmit: document.getElementById('btn-submit'),
        
        screenVault: document.getElementById('screen-vault'),
        btnVaultBackMenu: document.getElementById('btn-vault-back-menu'),
        vaultList: document.getElementById('vault-list'),
        btnVaultGoToday: document.getElementById('btn-vault-go-today'),
        
        toast: document.getElementById('toast'),
        modalHelp: document.getElementById('modal-help'),
        modalStats: document.getElementById('modal-stats'),
        modalResult: document.getElementById('modal-result'),
        
        statPlayed: document.getElementById('stat-played'),
        statWinPct: document.getElementById('stat-win-pct'),
        statStreak: document.getElementById('stat-streak'),
        statMaxStreak: document.getElementById('stat-max-streak'),
        statZeroMistakes: document.getElementById('stat-zero-mistakes'),
        
        resultTitle: document.getElementById('result-title'),
        resultBadge: document.getElementById('result-badge'),
        resultMsg: document.getElementById('result-msg'),
        resultEmojiGrid: document.getElementById('result-emoji-grid'),
        btnShare: document.getElementById('btn-share'),
        btnResultMenu: document.getElementById('btn-result-menu')
      };
    }

    bindEvents() {
      this.dom.btnRetryInit.addEventListener('click', () => this.init());
      
      this.dom.btnPlayToday.addEventListener('click', () => {
        this.loadGame(APP_STATE.currentRelease, false);
      });
      this.dom.btnMenuVault.addEventListener('click', () => {
        this.renderVault();
        this.switchScreen('vault');
      });
      
      this.dom.btnMenuStats.addEventListener('click', () => this.openStats());
      this.dom.btnMenuHelp.addEventListener('click', () => this.openModal(this.dom.modalHelp));
      this.dom.btnMenuSound.addEventListener('click', () => this.toggleSound());
      this.dom.btnGameSound.addEventListener('click', () => this.toggleSound());
      
      this.dom.btnBackToMenu.addEventListener('click', () => {
        this.updateMenuCard();
        this.switchScreen('menu');
      });
      
      this.dom.btnShuffle.addEventListener('click', () => this.shuffleTiles());
      this.dom.btnDeselect.addEventListener('click', () => this.deselectAll());
      this.dom.btnSubmit.addEventListener('click', () => this.submitSelection());
      
      this.dom.btnVaultBackMenu.addEventListener('click', () => this.switchScreen('menu'));
      this.dom.btnVaultGoToday.addEventListener('click', () => {
        if (APP_STATE.currentRelease) this.loadGame(APP_STATE.currentRelease, false);
      });
      
      this.dom.btnShare.addEventListener('click', () => this.shareResults());
      this.dom.btnResultMenu.addEventListener('click', () => {
        this.closeModal(this.dom.modalResult);
        this.updateMenuCard();
        this.switchScreen('menu');
      });
      
      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-close');
          const modal = document.getElementById(id);
          if (modal) this.closeModal(modal);
        });
      });
    }

    async init() {
      this.dom.btnRetryInit.classList.add('is-hidden');
      this.dom.loadingStatusText.textContent = "Verifying release schedule...";
      this.switchScreen('loading');

      const ukDate = await fetchAuthoritativeDate();
      if (!ukDate) return this.showInitError("Today's puzzle could not be verified.");

      let csvText;
      try {
        const response = await fetch(CONFIG.puzzleCsvPath, { cache: 'no-store' });
        if (!response.ok) throw new Error("HTTP Fetch Error");
        csvText = await response.text();
      } catch (err) {
        return this.showInitError("Puzzle data could not be loaded.");
      }

      const rows = parseCSV(csvText);
      if (rows.length < 2 || rows[0][0] !== 'release_date') {
        return this.showInitError("Puzzle data structure is invalid.");
      }

      const headers = rows[0];
      const validPuzzles = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length === headers.length) {
          const puzzle = mapRowToGameData(rows[i], headers);
          if (puzzle) validPuzzles.push(puzzle);
        }
      }

      let current = null;
      let duplicateCurrent = false;
      const vault = [];

      for (const puzzle of validPuzzles) {
        if (puzzle.release_date < ukDate) {
          vault.push(puzzle);
        } else if (puzzle.release_date === ukDate) {
          if (current) duplicateCurrent = true;
          current = puzzle;
        }
      }

      if (duplicateCurrent) current = null;

      APP_STATE.ukDate = ukDate;
      APP_STATE.currentRelease = current;
      APP_STATE.vaultReleases = vault.sort((a, b) => b.release_date.localeCompare(a.release_date));
      APP_STATE.isReady = true;

      this.updateSoundDisplay();

      if (!current) {
        this.showInitError("Today's puzzle is not available.");
      } else {
        this.updateMenuCard();
        this.switchScreen('menu');
      }
    }

    showInitError(msg) {
      this.dom.loadingStatusText.textContent = msg;
      this.dom.btnRetryInit.classList.remove('is-hidden');
    }

    switchScreen(screen) {
      this.dom.screenLoading.classList.add('is-hidden');
      this.dom.screenMenu.classList.add('is-hidden');
      this.dom.screenGame.classList.add('is-hidden');
      this.dom.screenVault.classList.add('is-hidden');
      if (screen === 'loading') this.dom.screenLoading.classList.remove('is-hidden');
      if (screen === 'menu') this.dom.screenMenu.classList.remove('is-hidden');
      if (screen === 'game') this.dom.screenGame.classList.remove('is-hidden');
      if (screen === 'vault') this.dom.screenVault.classList.remove('is-hidden');
    }

    toggleSound() {
      this.sound.toggle();
      this.updateSoundDisplay();
    }

    updateSoundDisplay() {
      const text = this.sound.enabled ? 'SOUND: ON' : 'SOUND: OFF';
      this.dom.menuSoundText.textContent = text;
      this.dom.btnGameSound.textContent = text;
    }

    updateMenuCard() {
      if (!APP_STATE.currentRelease) return;
      const p = APP_STATE.currentRelease;
      this.dom.menuDiffPill.textContent = p.difficulty.toUpperCase();
      this.dom.menuPuzzleTitle.textContent = p.title;

      const saved = this.storage.getGameState(p.id);
      if (!saved || (!saved.isComplete && saved.solvedCategories.length === 0)) {
        this.dom.menuStatusText.textContent = "Ready to play";
        this.dom.menuStatusText.className = "hero-status-indicator";
        this.dom.btnPlayTodayText.textContent = "PLAY";
      } else if (!saved.isComplete && saved.solvedCategories.length > 0) {
        this.dom.menuStatusText.textContent = `In Progress • ${saved.solvedCategories.length}/4 solved`;
        this.dom.menuStatusText.className = "hero-status-indicator";
        this.dom.btnPlayTodayText.textContent = "CONTINUE";
      } else {
        const win = saved.mistakesRemaining > 0;
        this.dom.menuStatusText.textContent = win ? "Completed Successfully" : "Revealed";
        this.dom.menuStatusText.className = "hero-status-indicator is-solved";
        this.dom.btnPlayTodayText.textContent = "VIEW BOARD";
      }
    }

    loadGame(puzzleData, isVault) {
      this.activePuzzle = puzzleData;
      this.isVaultPlay = isVault;
      
      this.dom.puzzleDateLabel.textContent = puzzleData.release_date;
      this.dom.puzzleDifficulty.textContent = puzzleData.difficulty.toUpperCase();
      
      this.selectedWords = [];
      this.solvedCategories = [];
      this.guessHistory = [];
      this.mistakesRemaining = CONFIG.maxMistakes;
      this.isComplete = false;

      const saved = this.storage.getGameState(puzzleData.id);
      if (saved) {
        this.solvedCategories = saved.solvedCategories || [];
        this.mistakesRemaining = saved.mistakesRemaining ?? CONFIG.maxMistakes;
        this.guessHistory = saved.guessHistory || [];
        this.isComplete = saved.isComplete || false;
      }

      const solvedSet = new Set();
      this.solvedCategories.forEach(cat => cat.items.forEach(i => solvedSet.add(i)));

      const remaining = [];
      puzzleData.categories.forEach(cat => {
        cat.items.forEach(item => {
          if (!solvedSet.has(item)) remaining.push(item);
        });
      });

      this.unsolvedTiles = remaining;
      this.shuffleArray(this.unsolvedTiles);
      
      this.renderBoard();
      this.renderMistakes();
      this.updateControls();
      this.switchScreen('game');
    }

    renderBoard() {
      this.dom.solvedStack.innerHTML = '';
      this.solvedCategories.forEach(cat => {
        const div = document.createElement('div');
        div.className = `solved-banner cat-${cat.difficulty}`;
        div.innerHTML = `<div class="solved-banner-title">${cat.name}</div><div class="solved-banner-items">${cat.items.join(', ')}</div>`;
        this.dom.solvedStack.appendChild(div);
      });

      this.dom.gridContainer.innerHTML = '';
      this.unsolvedTiles.forEach(word => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tile';
        if (this.selectedWords.includes(word)) btn.classList.add('is-selected');
        if (this.isComplete) btn.disabled = true;
        btn.innerHTML = `<span class="tile-text">${word}</span>`;
        btn.addEventListener('click', () => this.toggleSelect(word));
        this.dom.gridContainer.appendChild(btn);
      });
    }

    renderMistakes() {
      const dots = this.dom.mistakeIndicators.querySelectorAll('.dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < this.mistakesRemaining);
      });
    }

    updateControls() {
      const cnt = this.selectedWords.length;
      this.dom.btnSubmit.disabled = cnt !== 4 || this.isComplete;
      this.dom.btnDeselect.disabled = cnt === 0 || this.isComplete;
      this.dom.btnShuffle.disabled = this.unsolvedTiles.length <= 1 || this.isComplete;
    }

    toggleSelect(word) {
      if (this.isComplete) return;
      const idx = this.selectedWords.indexOf(word);
      if (idx > -1) {
        this.selectedWords.splice(idx, 1);
        this.sound.playDeselect();
      } else {
        if (this.selectedWords.length >= 4) return this.showToast('Select exactly 4 items');
        this.selectedWords.push(word);
        this.sound.playTap();
      }
      this.renderBoard();
      this.updateControls();
    }

    deselectAll() {
      if (this.selectedWords.length === 0) return;
      this.selectedWords = [];
      this.sound.playDeselect();
      this.renderBoard();
      this.updateControls();
    }

    shuffleTiles() {
      if (this.unsolvedTiles.length <= 1 || this.isComplete) return;
      this.shuffleArray(this.unsolvedTiles);
      this.renderBoard();
    }

    submitSelection() {
      if (this.selectedWords.length !== 4 || this.isComplete) return;
      
      const sorted = [...this.selectedWords].sort().join('|');
      const already = this.guessHistory.some(g => [...g].sort().join('|') === sorted);
      if (already) {
        this.showToast('Already guessed!');
        return;
      }

      this.guessHistory.push([...this.selectedWords]);

      let match = null;
      for (const cat of this.activePuzzle.categories) {
        const set = new Set(cat.items);
        if (this.selectedWords.filter(w => set.has(w)).length === 4) {
          match = cat;
          break;
        }
      }

      if (match) {
        this.sound.playSuccess();
        this.solvedCategories.push(match);
        this.unsolvedTiles = this.unsolvedTiles.filter(w => !match.items.includes(w));
        this.selectedWords = [];

        if (this.solvedCategories.length === 3) {
          const last = this.activePuzzle.categories.find(c => !this.solvedCategories.includes(c));
          if (last) {
            this.solvedCategories.push(last);
            this.unsolvedTiles = [];
          }
        }
        
        if (this.solvedCategories.length === 4) {
          this.endGame(true);
        } else {
          this.saveState();
          this.renderBoard();
          this.updateControls();
        }
      } else {
        this.sound.playError();
        this.mistakesRemaining--;
        this.renderMistakes();
        
        const domTiles = this.dom.gridContainer.querySelectorAll('.tile.is-selected');
        domTiles.forEach(t => t.classList.add('shake-group'));
        setTimeout(() => domTiles.forEach(t => t.classList.remove('shake-group')), 450);

        if (this.mistakesRemaining <= 0) {
          this.showToast('Out of guesses!');
          this.isComplete = true;
          setTimeout(() => {
            this.solvedCategories = [...this.activePuzzle.categories];
            this.unsolvedTiles = [];
            this.selectedWords = [];
            this.endGame(false);
          }, 1000);
        } else {
          this.saveState();
        }
      }
    }

    endGame(isWin) {
      this.isComplete = true;
      this.saveState();
      this.renderBoard();
      this.updateControls();
      
      if (!this.isVaultPlay) {
        const existing = this.storage.getGameState(this.activePuzzle.id);
        if (!existing || !existing.hasRecorded) {
          if (isWin) this.storage.recordWin(this.mistakesRemaining);
          else this.storage.recordLoss();
          
          const state = this.storage.getGameState(this.activePuzzle.id);
          state.hasRecorded = true;
          this.storage.setGameState(this.activePuzzle.id, state);
        }
      }
      
      setTimeout(() => this.showResult(isWin), 750);
    }

    saveState() {
      const old = this.storage.getGameState(this.activePuzzle.id) || {};
      this.storage.setGameState(this.activePuzzle.id, {
        isComplete: this.isComplete,
        mistakesRemaining: this.mistakesRemaining,
        solvedCategories: this.solvedCategories,
        guessHistory: this.guessHistory,
        hasRecorded: old.hasRecorded || false
      });
    }

    renderVault() {
      this.dom.vaultList.innerHTML = '';
      if (APP_STATE.vaultReleases.length === 0) {
        this.dom.vaultList.innerHTML = `<div class="vault-empty">No past puzzles available.</div>`;
        return;
      }
      APP_STATE.vaultReleases.forEach(puzzle => {
        const card = document.createElement('div');
        card.className = 'vault-card';
        const st = this.storage.getGameState(puzzle.id);
        let badge = '<span class="vault-badge badge-ready">UNPLAYED</span>';
        if (st && st.isComplete) badge = st.mistakesRemaining > 0 ? '<span class="vault-badge badge-won">SOLVED</span>' : '<span class="vault-badge badge-lost">REVEALED</span>';
        
        card.innerHTML = `<span class="vault-card-title">${puzzle.release_date} - ${puzzle.title}</span>${badge}`;
        card.addEventListener('click', () => {
          this.loadGame(puzzle, true);
        });
        this.dom.vaultList.appendChild(card);
      });
    }

    showResult(isWin) {
      this.dom.resultTitle.textContent = isWin ? 'ROUND WON' : 'GAME OVER';
      this.dom.resultBadge.textContent = isWin ? 'SOLVED' : 'REVEALED';
      this.dom.resultMsg.textContent = isWin ? 'All groups successfully identified!' : 'All groups have been revealed.';
      
      this.dom.resultEmojiGrid.innerHTML = '';
      const map = {};
      this.activePuzzle.categories.forEach(c => c.items.forEach(i => map[i] = c.difficulty));
      this.guessHistory.forEach(g => {
        const row = document.createElement('div');
        row.textContent = g.map(w => CONFIG.categoryColors[map[w]] || '⬜').join('');
        this.dom.resultEmojiGrid.appendChild(row);
      });
      this.openModal(this.dom.modalResult);
    }

    shareResults() {
      const map = {};
      this.activePuzzle.categories.forEach(c => c.items.forEach(i => map[i] = c.difficulty));
      const emojis = this.guessHistory.map(g => g.map(w => CONFIG.categoryColors[map[w]] || '⬜').join('')).join('\n');
      const text = `Connections — ${this.activePuzzle.release_date}\n${emojis}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => this.showToast('Copied to clipboard!'));
      }
    }

    openStats() {
      const s = this.storage.state.stats;
      this.dom.statPlayed.textContent = s.played;
      this.dom.statWinPct.textContent = s.played > 0 ? Math.round((s.won / s.played) * 100) + '%' : '0%';
      this.dom.statStreak.textContent = s.currentStreak;
      this.dom.statMaxStreak.textContent = s.maxStreak;
      this.dom.statZeroMistakes.textContent = s.zeroMistakes;
      this.openModal(this.dom.modalStats);
    }

    openModal(m) { m.classList.remove('is-hidden'); }
    closeModal(m) { m.classList.add('is-hidden'); }
    
    showToast(msg) {
      this.dom.toast.textContent = msg;
      this.dom.toast.classList.add('is-visible');
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.dom.toast.classList.remove('is-visible'), 2200);
    }

    shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => { window.app = new Application(); });
})();