// Ueno quest: the Tokyo text adventure in the Playground card.
const MUD_LEADERBOARD_STORAGE_KEY = 'tokyo-mud-leaderboard';
const MUD_STATE_STORAGE_KEY = 'tokyo-mud-current-run';
const MUD_PUBLIC_LEADERBOARD_URL = 'data/mud-leaderboard.json';
const MUD_STAGE_LABELS = {
  apartment: 'Apartment near Ueno Park',
  street: 'Street outside the apartment',
  stationGate: 'Ueno station gates',
  subway: 'Tokyo Metro',
  work: 'Office near Otemachi',
  shibuya: 'Tech event in Shibuya',
  returnTrain: 'Subway home',
  home: 'Apartment kitchen',
  won: 'Home, fed, victorious',
};
const MUD_SIDE_QUEST_LABELS = {
  plant: 'Watered balcony plant',
  park: 'Visited Ueno Park',
  tourist: 'Helped lost tourist',
  refactor: 'Refactored old code',
  question: 'Asked event question',
  textMom: 'Texted mom',
};
const MUD_STAGE_LABELS_JA = {
  apartment: '上野公園近くのアパート',
  street: 'アパートの外',
  stationGate: '上野駅の改札',
  subway: '東京メトロ',
  work: '大手町のオフィス',
  shibuya: 'テックイベント',
  returnTrain: '帰りの地下鉄',
  home: 'アパートのキッチン',
  won: '帰宅、食事、勝利',
};
const MUD_SIDE_QUEST_LABELS_JA = {
  plant: 'ベランダの植物に水をあげた',
  park: '上野公園に寄った',
  tourist: '迷った旅行者を助けた',
  refactor: '古いコードをリファクタした',
  question: 'イベントで質問した',
  textMom: '母にメッセージした',
};
const mudStartButton = document.getElementById('mud-start');
const mudForm = document.getElementById('mud-form');
const mudCommandInput = document.getElementById('mud-command');
const mudCommandButtons = document.getElementById('mud-command-buttons');
const mudLog = document.getElementById('mud-log');
const mudStatus = document.getElementById('mud-status');
const mudLeaderboard = document.getElementById('mud-leaderboard');
let publicMudLeaderboardEntries = [];
let mudState = null;

function isMudJapanese() {
  return document.documentElement.lang === 'ja';
}

function mudText(en, ja) {
  return isMudJapanese() ? ja : en;
}

function mudStageLabel(stage) {
  return isMudJapanese() ? MUD_STAGE_LABELS_JA[stage] || MUD_STAGE_LABELS[stage] : MUD_STAGE_LABELS[stage];
}

function mudSideQuestLabel(key) {
  return isMudJapanese() ? MUD_SIDE_QUEST_LABELS_JA[key] || MUD_SIDE_QUEST_LABELS[key] : MUD_SIDE_QUEST_LABELS[key];
}

function mudMovesText(moves) {
  return mudText(`${moves} moves.`, `${moves}手。`);
}

function mudFinishedText(moves) {
  return mudText(`Finished in ${moves} moves.`, `${moves}手でクリア。`);
}

function mudReadyText() {
  return mudText('Ready.', '準備完了。');
}

function createMudState() {
  return {
    stage: 'apartment',
    ready: false,
    hasRedBull: false,
    work: {
      feature: false,
      bugsFixed: 0,
      pricing: false,
    },
    attendedEvent: false,
    sideQuests: {},
    moves: 0,
    won: false,
  };
}

function normalizeStoredMudState(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const state = createMudState();
  if (Object.prototype.hasOwnProperty.call(MUD_STAGE_LABELS, value.stage)) {
    state.stage = value.stage;
  }
  state.ready = Boolean(value.ready);
  state.hasRedBull = Boolean(value.hasRedBull);
  state.work = {
    feature: Boolean(value.work?.feature),
    bugsFixed: Math.min(Math.max(Number(value.work?.bugsFixed) || 0, 0), 3),
    pricing: Boolean(value.work?.pricing),
  };
  state.attendedEvent = Boolean(value.attendedEvent);
  state.sideQuests = Object.keys(MUD_SIDE_QUEST_LABELS).reduce((sideQuests, key) => {
    sideQuests[key] = Boolean(value.sideQuests?.[key]);
    return sideQuests;
  }, {});
  state.moves = Math.min(Math.max(Number(value.moves) || 0, 0), 999);
  state.won = Boolean(value.won);
  if (state.won) {
    state.stage = 'won';
  }
  return state;
}

function getSavedMudState() {
  try {
    return normalizeStoredMudState(JSON.parse(localStorage.getItem(MUD_STATE_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

function saveMudState() {
  if (!mudState) {
    return;
  }
  try {
    localStorage.setItem(MUD_STATE_STORAGE_KEY, JSON.stringify(mudState));
  } catch {}
}

function setMudStatus(message) {
  if (mudStatus) {
    mudStatus.textContent = message;
  }
}

function clearMudLog() {
  if (mudLog) {
    mudLog.textContent = '';
  }
}

function renderMudIdleMessage() {
  if (!mudLog) {
    return;
  }
  mudLog.textContent = '';
  const line = document.createElement('p');
  line.textContent = mudText(
    'Click New run, then try: look, get ready, go downstairs.',
    '「New run」をクリックして、「見る」「身支度する」「下へ行く」を試してみてください。',
  );
  mudLog.append(line);
}

function renderMudInputLanguage() {
  if (mudCommandInput) {
    mudCommandInput.placeholder = mudText('look', '見る');
  }
}

function appendMudLine(speaker, text) {
  if (!mudLog) {
    return;
  }
  const line = document.createElement('p');
  line.className = `mud-line mud-line-${speaker}`;
  line.textContent = text;
  mudLog.append(line);
  mudLog.scrollTop = mudLog.scrollHeight;
}

function normalizeMudCommand(command) {
  return command
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function commandHas(command, terms) {
  return terms.some((term) => command.includes(term));
}

function getMudLeaderboard() {
  try {
    const value = JSON.parse(localStorage.getItem(MUD_LEADERBOARD_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveMudLeaderboard(entries) {
  try {
    localStorage.setItem(MUD_LEADERBOARD_STORAGE_KEY, JSON.stringify(entries.slice(0, 5)));
  } catch {}
}

function getCombinedMudLeaderboard() {
  const entriesById = new Map();
  publicMudLeaderboardEntries.forEach((entry) => {
    if (entry?.id) {
      entriesById.set(entry.id, entry);
    }
  });
  getMudLeaderboard().forEach((entry) => {
    if (entry?.id && entriesById.has(entry.id)) {
      return;
    }
    entriesById.set(entry?.id || `local-${entry?.completedAt || Math.random()}`, {
      ...entry,
      isLocal: true,
    });
  });
  return Array.from(entriesById.values())
    .filter((entry) => entry?.name && Number.isFinite(Number(entry.moves)))
    .sort((a, b) => (
      Number(a.moves) - Number(b.moves)
      || getEntrySideQuestCount(b) - getEntrySideQuestCount(a)
      || String(a.completedAt || '').localeCompare(String(b.completedAt || ''))
    ))
    .slice(0, 5);
}

function getCompletedSideQuestKeys() {
  if (!mudState?.sideQuests) {
    return [];
  }
  return Object.keys(MUD_SIDE_QUEST_LABELS).filter((key) => mudState.sideQuests[key]);
}

function getCompletedSideQuestNames() {
  return getCompletedSideQuestKeys().map((key) => MUD_SIDE_QUEST_LABELS[key]);
}

function getEntrySideQuestCount(entry) {
  if (Array.isArray(entry?.sideQuests)) {
    return entry.sideQuests.length;
  }
  return Number(entry?.sideQuestCount) || 0;
}

function renderMudLeaderboard() {
  if (!mudLeaderboard) {
    return;
  }
  const entries = getCombinedMudLeaderboard();
  if (!entries.length) {
    mudLeaderboard.textContent = mudText('Leaderboard: no winners yet.', 'リーダーボード：まだ勝者はいません。');
    return;
  }
  mudLeaderboard.textContent = '';

  const summaryElement = document.createElement('div');
  summaryElement.className = 'mud-leaderboard-summary';
  summaryElement.textContent = mudText('Leaderboard:', 'リーダーボード：');
  mudLeaderboard.append(summaryElement);

  const list = document.createElement('ul');
  list.className = 'mud-leaderboard-entries';
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const sideQuestCount = getEntrySideQuestCount(entry);
    const sideQuestText = sideQuestCount
      ? mudText(`, ${sideQuestCount} side quest${sideQuestCount === 1 ? '' : 's'}`, `、サイドクエスト${sideQuestCount}件`)
      : '';
    const localText = entry.isLocal ? mudText(' (local)', '（ローカル）') : '';
    item.textContent = mudText(
      `${index + 1}. ${entry.name} - ${entry.moves} moves${sideQuestText}${localText}`,
      `${index + 1}. ${entry.name} - ${entry.moves}手${sideQuestText}${localText}`,
    );
    list.append(item);
  });
  mudLeaderboard.append(list);
}

async function fetchMudLeaderboard() {
  try {
    let data = null;
    if (PORTFOLIO_API_BASE_URL) {
      try {
        const apiResponse = await fetch(`${PORTFOLIO_API_BASE_URL}/api/content/mud-leaderboard`, { cache: 'no-store' });
        if (!apiResponse.ok) throw new Error(`Leaderboard API request failed: ${apiResponse.status}`);
        data = await apiResponse.json();
      } catch {
        data = null;
      }
    }
    if (!data) {
      const response = await fetch(MUD_PUBLIC_LEADERBOARD_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
      data = await response.json();
    }
    publicMudLeaderboardEntries = Array.isArray(data.entries) ? data.entries : [];
  } catch {
    publicMudLeaderboardEntries = [];
  }
  renderMudLeaderboard();
}

function workProgressText() {
  const tasks = isMudJapanese()
    ? [
      mudState.work.feature ? '機能リリース済み' : '機能は未完了',
      `バグ修正 ${mudState.work.bugsFixed}/3`,
      mudState.work.pricing ? '料金プラン提案済み' : '料金プランは未提案',
    ]
    : [
      mudState.work.feature ? 'feature shipped' : 'feature pending',
      `${mudState.work.bugsFixed}/3 bugs fixed`,
      mudState.work.pricing ? 'pricing tier pitched' : 'pricing pitch pending',
    ];
  return tasks.join(', ');
}

function workNextStepText() {
  return canLeaveWork()
    ? mudText('All work tasks are done. Go to the tech event.', '仕事はすべて完了。テックイベントへ向かいましょう。')
    : mudText(`Work board: ${workProgressText()}.`, `仕事ボード：${workProgressText()}。`);
}

function describeMudLocation() {
  if (!mudState) {
    return mudText('Click New run to start.', '「New run」で開始します。');
  }
  switch (mudState.stage) {
    case 'apartment':
      return mudState.ready
        ? mudText(
          'Your apartment near Ueno Park is tidy enough. Shoes wait by the genkan. The stairs lead down.',
          '上野公園近くのアパートは、まあまあ片付いています。玄関に靴、下へ続く階段。',
        )
        : mudText(
          'You wake in an apartment near Ueno Park. A laptop bag, clean shirt, and house keys demand attention.',
          '上野公園近くのアパートで目覚めます。ラップトップバッグ、きれいなシャツ、家の鍵があなたを待っています。',
        );
    case 'street':
      return mudState.hasRedBull
        ? mudText(
          'Outside, cicadas buzz over vending machines. A cold Red Bull is in your bag. The subway entrance waits.',
          '外では自販機の上で蝉が鳴いています。冷えたRed Bullはバッグの中。地下鉄入口が待っています。',
        )
        : mudText(
          'You are downstairs near Ueno Park. A konbini glows beside the subway entrance. You need a Red Bull first.',
          '上野公園近くの路上にいます。地下鉄入口の横でコンビニが光っています。まずRed Bullが必要です。',
        );
    case 'stationGate':
      return mudText(
        'At Ueno station gates, commuters stream past. You have caffeine. Time to get on the subway.',
        '上野駅の改札で通勤客が流れていきます。カフェインは確保済み。地下鉄に乗る時間です。',
      );
    case 'subway':
      return mudText(
        'The subway rattles south. Ads for English schools and cloud services sway overhead. Otemachi is coming.',
        '地下鉄は南へ揺れます。英会話とクラウドサービスの広告が頭上で揺れています。大手町が近づいています。',
      );
    case 'work':
      return mudText(
        `The Otemachi office hums with monitors and canned coffee. ${workNextStepText()}`,
        `大手町のオフィスはモニターと缶コーヒーで低く唸っています。${workNextStepText()}`,
      );
    case 'shibuya':
      return mudState.attendedEvent
        ? mudText(
          'The tech event has ended. Stickers acquired, small talk survived. The subway can take you home.',
          'テックイベントは終了しました。ステッカーを手に入れ、雑談も生き延びました。地下鉄で帰れます。',
        )
        : mudText(
          'You arrive at a tech event. Someone is explaining agents near the pizza table.',
          'テックイベントに到着しました。ピザの横で誰かがエージェントについて説明しています。',
        );
    case 'returnTrain':
      return mudText(
        'The late subway rolls toward Ueno. Your backpack is heavier with swag and existential dread.',
        '夜の地下鉄は上野へ向かいます。バックパックはノベルティと実存的不安で少し重い。',
      );
    case 'home':
      return mudText(
        'Back in your apartment kitchen. A pot, soba noodles, and tsuyu await.',
        'アパートのキッチンに戻りました。鍋、そば、つゆが待っています。',
      );
    case 'won':
      return mudText(
        'You made soba and survived the Tokyo workday. Victory tastes like buckwheat.',
        'そばを作り、東京の仕事日を生き延びました。勝利はそばの味。',
      );
    default:
      return mudText('Tokyo glitches around you. Try look.', '東京が少しバグっています。「見る」を試してください。');
  }
}

function canLeaveWork() {
  return mudState.work.feature && mudState.work.bugsFixed >= 3 && mudState.work.pricing;
}

function getMudCommandOptions() {
  if (!mudState || mudState.won) {
    return [];
  }

  const commands = [
    { label: mudText('Look', '見る'), command: 'look' },
    { label: mudText('Inventory', '持ち物'), command: 'inventory' },
  ];

  if (mudState.stage === 'apartment') {
    if (!mudState.sideQuests.plant) {
      commands.push({ label: mudText('Water plant', '植物に水をあげる'), command: 'water plant' });
    }
    if (!mudState.ready) {
      commands.push({ label: mudText('Get ready', '身支度する'), command: 'get ready' });
    } else {
      commands.push({ label: mudText('Go downstairs', '下へ行く'), command: 'go downstairs' });
    }
  } else if (mudState.stage === 'street') {
    if (!mudState.sideQuests.park) {
      commands.push({ label: mudText('Visit Ueno Park', '上野公園に寄る'), command: 'visit Ueno Park' });
    }
    commands.push({ label: mudText('Buy Red Bull', 'Red Bullを買う'), command: 'buy red bull' });
  } else if (mudState.stage === 'stationGate') {
    if (!mudState.sideQuests.tourist) {
      commands.push({ label: mudText('Help tourist', '旅行者を助ける'), command: 'help tourist' });
    }
    commands.push({ label: mudText('Get on subway', '地下鉄に乗る'), command: 'get on subway' });
  } else if (mudState.stage === 'subway') {
    commands.push({ label: mudText('Get off at Otemachi', '大手町で降りる'), command: 'get off at Otemachi' });
  } else if (mudState.stage === 'work') {
    if (!mudState.sideQuests.refactor) {
      commands.push({ label: mudText('Refactor old code', '古いコードを直す'), command: 'refactor old code' });
    }
    if (!mudState.work.feature) {
      commands.push({ label: mudText('Implement feature', '機能を実装する'), command: 'implement feature' });
    }
    if (mudState.work.bugsFixed < 3) {
      commands.push({
        label: mudText(`Fix bug ${mudState.work.bugsFixed + 1}`, `バグ${mudState.work.bugsFixed + 1}を直す`),
        command: 'fix bug',
      });
    }
    if (!mudState.work.pricing) {
      commands.push({ label: mudText('Pitch pricing tier', '料金プランを提案する'), command: 'pitch pricing tier' });
    }
    if (canLeaveWork()) {
      commands.push({ label: mudText('Go to tech event', 'テックイベントへ行く'), command: 'go shibuya' });
    }
  } else if (mudState.stage === 'shibuya') {
    if (!mudState.sideQuests.question) {
      commands.push({ label: mudText('Ask a question', '質問する'), command: 'ask a question' });
    }
    if (!mudState.attendedEvent) {
      commands.push({ label: mudText('Attend tech event', 'イベントに参加する'), command: 'attend tech event' });
    } else {
      commands.push({ label: mudText('Take subway home', '地下鉄で帰る'), command: 'go subway' });
    }
  } else if (mudState.stage === 'returnTrain') {
    commands.push({ label: mudText('Go home', '家へ帰る'), command: 'go home' });
  } else if (mudState.stage === 'home') {
    if (!mudState.sideQuests.textMom) {
      commands.push({ label: mudText('Text mom', '母にメッセージする'), command: 'text mom' });
    }
    commands.push({ label: mudText('Make soba', 'そばを作る'), command: 'make soba' });
  }

  return commands;
}

function renderMudCommandButtons() {
  if (!mudCommandButtons) {
    return;
  }

  mudCommandButtons.textContent = '';
  const commands = getMudCommandOptions();
  mudCommandButtons.hidden = !commands.length;
  commands.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mud-command-button';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      executeMudCommand(option.command, option.label);
      button.blur();
    });
    mudCommandButtons.append(button);
  });
}

function completeMudRun() {
  mudState.won = true;
  mudState.stage = 'won';
  const sideQuestCount = getCompletedSideQuestKeys().length;
  setMudStatus(mudFinishedText(mudState.moves));
  appendMudLine('system', mudText(
    'You rinse the soba, pour the tsuyu, and sit by the window. Ueno is quiet. You win.',
    'そばをしめ、つゆを注ぎ、窓辺に座る。上野は静かです。勝利です。',
  ));
  appendMudLine('system', mudText(
    `Run summary: ${mudState.moves} moves, ${sideQuestCount}/${Object.keys(MUD_SIDE_QUEST_LABELS).length} side quests.`,
    `結果：${mudState.moves}手、サイドクエスト${sideQuestCount}/${Object.keys(MUD_SIDE_QUEST_LABELS).length}件。`,
  ));
  saveMudState();
  appendMudLine('system', mudText(
    'Submit your score for approval in the dialog.',
    'ダイアログからスコアを承認待ちとして送信できます。',
  ));
  window.openPortfolioSubmission?.('mud-score', {
    moves: mudState.moves,
    sideQuests: getCompletedSideQuestNames(),
    completedAt: new Date().toISOString(),
  });
}

function executeMudCommand(command, displayCommand = command) {
  if (!mudState) {
    startMudRun();
  }
  if (!command) {
    return;
  }

  appendMudLine('player', `> ${displayCommand}`);
  const response = handleMudAction(command);
  if (response) {
    appendMudLine('system', response);
  }
  saveMudState();
  renderMudCommandButtons();
  mudCommandInput?.focus();
}

function handleMudAction(rawCommand) {
  const command = normalizeMudCommand(rawCommand);
  if (!command) {
    return '';
  }
  if (command === 'help' || command === '?' || command === 'ヘルプ') {
    return mudText(
      'Use the buttons for available commands. Low moves matter, but optional side quests can improve a run.',
      '使えるコマンドはボタンで表示されます。少ない手数も大事ですが、サイドクエストも記録されます。',
    );
  }
  if (command === 'look' || command === 'l' || command === '見る') {
    return describeMudLocation();
  }
  if (command === 'inventory' || command === 'i' || command === '持ち物') {
    const items = isMudJapanese() ? ['スマホ', '財布', 'Suica'] : ['phone', 'wallet', 'Suica'];
    if (mudState.ready) items.push(mudText('laptop bag', 'ラップトップバッグ'));
    if (mudState.hasRedBull) items.push('Red Bull');
    return mudText(`Inventory: ${items.join(', ')}.`, `持ち物：${items.join('、')}。`);
  }
  if (command === 'status' || command === 'ステータス') {
    const sideQuestCount = getCompletedSideQuestKeys().length;
    return mudText(
      `${mudStageLabel(mudState.stage)}. Moves: ${mudState.moves}. Side quests: ${sideQuestCount}/${Object.keys(MUD_SIDE_QUEST_LABELS).length}. ${workProgressText()}.`,
      `${mudStageLabel(mudState.stage)}。手数：${mudState.moves}。サイドクエスト：${sideQuestCount}/${Object.keys(MUD_SIDE_QUEST_LABELS).length}。${workProgressText()}。`,
    );
  }

  mudState.moves += 1;
  setMudStatus(mudMovesText(mudState.moves));

  if (mudState.stage === 'apartment') {
    if (commandHas(command, ['water plant', 'plant', 'balcony', '植物', '水'])) {
      if (mudState.sideQuests.plant) {
        return mudText(
          'The balcony plant is already watered. It looks smugly hydrated.',
          'ベランダの植物にはもう水をあげました。妙に満足げです。',
        );
      }
      mudState.sideQuests.plant = true;
      return mudText(
        'You water the balcony plant. It will remember this when Tokyo summer arrives.',
        'ベランダの植物に水をあげました。東京の夏が来たら、きっと覚えていてくれます。',
      );
    }
    if (commandHas(command, ['get ready', 'shower', 'dress', 'pack', 'keys', 'laptop', '身支度', '準備', 'シャワー', '着替え', '鍵'])) {
      mudState.ready = true;
      return mudText(
        'You shower, dress, grab keys, wallet, Suica, and laptop bag. The morning has been compiled.',
        'シャワーを浴び、着替えて、鍵、財布、Suica、ラップトップバッグを持ちました。朝のビルド成功。',
      );
    }
    if (commandHas(command, ['downstairs', 'leave', 'go out', 'stairs', '下', '出る', '階段'])) {
      if (!mudState.ready) {
        return mudText(
          'You are not ready. The laptop bag stares at you with professional disappointment.',
          'まだ準備ができていません。ラップトップバッグが仕事用の失望感で見つめています。',
        );
      }
      mudState.stage = 'street';
      return mudText(
        'You lock the apartment and go downstairs. Ueno Park breathes green across the morning street.',
        'アパートに鍵をかけて下へ降ります。朝の通りの向こうで、上野公園の緑が息をしています。',
      );
    }
    return mudText(
      'You need to get ready before leaving the apartment.',
      'アパートを出る前に身支度が必要です。',
    );
  }

  if (mudState.stage === 'street') {
    if (commandHas(command, ['visit ueno park', 'ueno park', 'park', 'pond', '上野公園', '公園', '池'])) {
      if (mudState.sideQuests.park) {
        return mudText(
          'You already visited Ueno Park. The swan boats remain emotionally unavailable.',
          '上野公園にはもう寄りました。スワンボートは相変わらず感情を見せません。',
        );
      }
      mudState.sideQuests.park = true;
      return mudText(
        'You detour through Ueno Park. Shinobazu Pond sparkles; a crow judges your calendar management.',
        '上野公園を少し回り道します。不忍池がきらめき、カラスがあなたの予定管理を批評しています。',
      );
    }
    if (commandHas(command, ['buy red bull', 'red bull', 'konbini', 'convenience', 'combini', '買う', 'コンビニ'])) {
      mudState.hasRedBull = true;
      mudState.stage = 'stationGate';
      return mudText(
        'You buy a Red Bull from the konbini. The clerk bags it with the gravity of a sacred relic.',
        'コンビニでRed Bullを買いました。店員さんは聖遺物のような重みで袋に入れてくれます。',
      );
    }
    if (commandHas(command, ['subway', 'station', 'train', '地下鉄', '駅', '電車'])) {
      return mudText(
        'You cannot enter the subway uncaffeinated. The quest demands Red Bull.',
        'カフェインなしでは地下鉄に入れません。このクエストにはRed Bullが必要です。',
      );
    }
    return mudText(
      'The konbini glows. Buy a Red Bull before entering the subway.',
      'コンビニが光っています。地下鉄に入る前にRed Bullを買いましょう。',
    );
  }

  if (mudState.stage === 'stationGate') {
    if (commandHas(command, ['help tourist', 'tourist', 'directions', 'help', '旅行者', '観光客', '道案内', '助ける'])) {
      if (mudState.sideQuests.tourist) {
        return mudText(
          'The tourist has already been helped and is now confidently walking the wrong way by choice.',
          '旅行者はもう助けました。今は自分の意志で堂々と逆方向へ歩いています。',
        );
      }
      mudState.sideQuests.tourist = true;
      return mudText(
        'You help a lost tourist find the Ginza line. They reward you with a grateful thumbs-up.',
        '迷った旅行者に銀座線の場所を教えました。感謝のサムズアップをもらいます。',
      );
    }
    if (commandHas(command, ['enter subway', 'get on', 'board', 'subway', 'train', 'tap in', '地下鉄', '乗る', '改札', '電車'])) {
      mudState.stage = 'subway';
      return mudText(
        'You tap through the gate and board the subway. The doors chime shut.',
        '改札をタッチして地下鉄に乗ります。ドアがチャイムとともに閉まります。',
      );
    }
    return mudText(
      'Get on the subway. The office waits under fluorescent lights.',
      '地下鉄に乗りましょう。蛍光灯の下でオフィスが待っています。',
    );
  }

  if (mudState.stage === 'subway') {
    if (commandHas(command, ['get off', 'otemachi', 'exit', 'leave train', '大手町', '降りる', '出る'])) {
      mudState.stage = 'work';
      return mudText(
        'You get off at Otemachi and surface among towers. The office absorbs you.',
        '大手町で降り、高層ビルの間に出ます。オフィスに吸い込まれました。',
      );
    }
    return mudText(
      'Stay on until Otemachi. You are not spiritually prepared for a random transfer.',
      '大手町まで乗り続けましょう。ランダムな乗り換えに耐える心の準備はまだありません。',
    );
  }

  if (mudState.stage === 'work') {
    if (commandHas(command, ['refactor old code', 'refactor', 'old code', 'cleanup', 'リファクタ', '古いコード', '直す', '整理'])) {
      if (mudState.sideQuests.refactor) {
        return mudText(
          'The old code has already been refactored. You briefly consider rewriting it in Rust anyway.',
          '古いコードはもうリファクタ済みです。それでも一瞬Rustで書き直すことを考えます。',
        );
      }
      mudState.sideQuests.refactor = true;
      return mudText(
        'You refactor old code nobody asked about. The diff is smaller and your soul is lighter.',
        '誰にも頼まれていない古いコードをリファクタしました。差分は小さくなり、心は軽くなります。',
      );
    }
    if (commandHas(command, ['implement feature', 'ship feature', 'build feature', 'feature', '機能', '実装', 'リリース'])) {
      if (mudState.work.feature) {
        return mudText(
          'The feature is already implemented. Product nods once, mysteriously.',
          'その機能はもう実装済みです。プロダクト担当が謎めいたうなずきを一度します。',
        );
      }
      mudState.work.feature = true;
      return mudText(
        `You implement one feature. It even works in the simulator. ${workNextStepText()}`,
        `機能を1つ実装しました。シミュレータでも動いています。${workNextStepText()}`,
      );
    }
    if (commandHas(command, ['fix bug', 'bug', 'バグ', '修正'])) {
      if (mudState.work.bugsFixed >= 3) {
        return mudText(
          `Three bugs are fixed. Any more and QA might get suspicious. ${workNextStepText()}`,
          `バグは3つ修正済みです。これ以上直すとQAに怪しまれます。${workNextStepText()}`,
        );
      }
      mudState.work.bugsFixed += 1;
      return mudText(
        `Bug ${mudState.work.bugsFixed} fixed. ${workNextStepText()}`,
        `バグ${mudState.work.bugsFixed}を修正しました。${workNextStepText()}`,
      );
    }
    if (commandHas(command, ['pitch pricing', 'pricing tier', 'new tier', 'pricing', '料金', 'プラン', '提案'])) {
      if (mudState.work.pricing) {
        return mudText(
          `The pricing tier has already been pitched. ${workNextStepText()}`,
          `料金プランはもう提案済みです。${workNextStepText()}`,
        );
      }
      mudState.work.pricing = true;
      return mudText(
        `You pitch a new pricing tier. Someone says "interesting" in a way that could mean anything. ${workNextStepText()}`,
        `新しい料金プランを提案しました。誰かが「面白いですね」と、何とも取れる声で言います。${workNextStepText()}`,
      );
    }
    if (commandHas(command, ['leave', 'shibuya', 'event', 'go out', '出る', 'イベント', 'テックイベント', '渋谷'])) {
      if (!canLeaveWork()) {
        return mudText(
          `You cannot leave yet. Work board: ${workProgressText()}.`,
          `まだ帰れません。仕事ボード：${workProgressText()}。`,
        );
      }
      mudState.stage = 'shibuya';
      return mudText(
        'Work complete, you escape to a tech event.',
        '仕事完了。テックイベントへ脱出します。',
      );
    }
    return mudText(`Work remains. ${workProgressText()}.`, `仕事が残っています。${workProgressText()}。`);
  }

  if (mudState.stage === 'shibuya') {
    if (commandHas(command, ['ask question', 'question', 'q a', 'panel', '質問', '聞く'])) {
      if (mudState.sideQuests.question) {
        return mudText(
          'You already asked a question. Asking another would transform networking into performance art.',
          'もう質問しました。さらに聞くと、ネットワーキングが舞台芸術になります。',
        );
      }
      mudState.sideQuests.question = true;
      return mudText(
        'You ask a question about on-device AI. Three people nod; one person checks LinkedIn.',
        'オンデバイスAIについて質問しました。3人がうなずき、1人がLinkedInを確認します。',
      );
    }
    if (commandHas(command, ['attend event', 'event', 'network', 'pizza', 'talk', 'イベント', '参加', 'ピザ', '話'])) {
      mudState.attendedEvent = true;
      return mudText(
        'You attend the event, nod at an architecture diagram, and acquire two stickers.',
        'イベントに参加し、アーキテクチャ図にうなずき、ステッカーを2枚手に入れました。',
      );
    }
    if (commandHas(command, ['go home', 'go subway', 'subway home', 'subway', 'station', 'leave', 'train home', 'take train', '帰る', '地下鉄', '駅', '電車'])) {
      if (!mudState.attendedEvent) {
        return mudText(
          'You just got here. Attend the tech event first.',
          '着いたばかりです。まずテックイベントに参加しましょう。',
        );
      }
      mudState.stage = 'home';
      return mudText(
        'You descend into the station, ride back toward Ueno, and climb the apartment stairs. The kitchen awaits.',
        '駅へ降り、上野方面へ戻り、アパートの階段を上ります。キッチンが待っています。',
      );
    }
    return mudState.attendedEvent
      ? mudText('The event is over. Take the subway home.', 'イベントは終わりました。地下鉄で帰りましょう。')
      : mudText('The event buzzes. Attend it, then you can head home.', 'イベントはにぎわっています。参加してから帰れます。');
  }

  if (mudState.stage === 'returnTrain') {
    if (commandHas(command, ['go home', 'get off', 'ueno', 'apartment', 'home', '帰る', '降りる', '上野', 'アパート'])) {
      mudState.stage = 'home';
      return mudText(
        'You get back near Ueno Park and climb the apartment stairs. The kitchen awaits.',
        '上野公園の近くまで戻り、アパートの階段を上ります。キッチンが待っています。',
      );
    }
    return mudText('Stay on the train until Ueno, then go home.', '上野まで乗ってから家へ帰りましょう。');
  }

  if (mudState.stage === 'home') {
    if (commandHas(command, ['text mom', 'mom', 'message family', '母', 'メッセージ', '連絡'])) {
      if (mudState.sideQuests.textMom) {
        return mudText(
          'You already texted mom. She has not replied, which means she is either busy or composing an essay.',
          '母にはもうメッセージしました。返信がないのは、忙しいか、長文を準備しているかのどちらかです。',
        );
      }
      mudState.sideQuests.textMom = true;
      return mudText(
        'You text your mom that you made it home. Somewhere, a notification becomes a side quest complete.',
        '無事帰ったと母にメッセージしました。どこかで通知がサイドクエスト完了になります。',
      );
    }
    if (commandHas(command, ['make soba', 'cook soba', 'soba', 'noodles', 'そば', '作る', '料理', '麺'])) {
      completeMudRun();
      return '';
    }
    return mudText('You are home. Make soba to finish the run.', '家にいます。そばを作ればクリアです。');
  }

  if (mudState.stage === 'won') {
    return mudText(
      'Run complete. Click New run to try for a better score.',
      'クリア済みです。より良いスコアを狙うならNew runをクリックしてください。',
    );
  }

  return mudText('Nothing happens. Tokyo remains undefeated.', '何も起きません。東京はまだ手強い。');
}

function startMudRun() {
  mudState = createMudState();
  clearMudLog();
  setMudStatus(mudMovesText(0));
  appendMudLine('system', 'UENO QUEST');
  appendMudLine('system', describeMudLocation());
  appendMudLine('system', mudText('Type help for commands.', 'コマンド一覧は「help」で確認できます。'));
  saveMudState();
  renderMudCommandButtons();
  mudCommandInput?.focus();
}

function restoreMudRun() {
  const savedState = getSavedMudState();
  if (!savedState) {
    return false;
  }

  mudState = savedState;
  clearMudLog();
  setMudStatus(mudState.won ? mudFinishedText(mudState.moves) : mudMovesText(mudState.moves));
  appendMudLine('system', mudState.won
    ? mudText('Restored completed UENO QUEST run.', 'クリア済みのUENO QUESTを復元しました。')
    : mudText('Restored saved UENO QUEST run.', '保存されたUENO QUESTを復元しました。'));
  appendMudLine('system', describeMudLocation());
  appendMudLine('system', mudText(
    'Click New run to reset, or continue with the buttons below.',
    'リセットするにはNew run、続けるには下のボタンを使ってください。',
  ));
  renderMudCommandButtons();
  return true;
}

function refreshMudLanguage() {
  renderMudLeaderboard();
  renderMudInputLanguage();
  if (!mudState) {
    setMudStatus(mudReadyText());
    renderMudIdleMessage();
    renderMudCommandButtons();
    return;
  }
  clearMudLog();
  setMudStatus(mudState.won ? mudFinishedText(mudState.moves) : mudMovesText(mudState.moves));
  appendMudLine('system', mudText('Current UENO QUEST run.', '現在のUENO QUESTです。'));
  appendMudLine('system', describeMudLocation());
  appendMudLine('system', mudText(
    'Click New run to reset, or continue with the buttons below.',
    'リセットするにはNew run、続けるには下のボタンを使ってください。',
  ));
  renderMudCommandButtons();
}

mudStartButton?.addEventListener('click', () => {
  startMudRun();
  mudStartButton.blur();
});

mudForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!mudState) {
    startMudRun();
  }
  const command = mudCommandInput?.value.trim();
  if (!command) {
    return;
  }
  mudCommandInput.value = '';
  executeMudCommand(command);
});

document.addEventListener('portfolio-submission-accepted', (event) => {
  if (event.detail?.kind !== 'mud-score') {
    return;
  }
  const payload = event.detail.payload;
  const entries = getMudLeaderboard();
  entries.push(payload);
  entries.sort((a, b) => a.moves - b.moves || getEntrySideQuestCount(b) - getEntrySideQuestCount(a) || a.completedAt.localeCompare(b.completedAt));
  saveMudLeaderboard(entries);
  renderMudLeaderboard();
  appendMudLine('system', mudText(
    `${payload.name} has a pending leaderboard score with ${payload.moves} moves and ${payload.sideQuests.length} side quests.`,
    `${payload.name}のリーダーボード申請：${payload.moves}手、サイドクエスト${payload.sideQuests.length}件。`,
  ));
});

renderMudLeaderboard();
renderMudInputLanguage();
if (!restoreMudRun()) {
  renderMudIdleMessage();
  renderMudCommandButtons();
}
fetchMudLeaderboard();
document.addEventListener('site-language-change', refreshMudLanguage);
