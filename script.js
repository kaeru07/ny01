const fileInput = document.getElementById("fileInput");
const logText = document.getElementById("logText");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const clearBtn = document.getElementById("clearBtn");
const statusText = document.getElementById("statusText");
const resultCard = document.getElementById("resultCard");
const summary = document.getElementById("summary");

let loadedFileText = "";

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  loadedFileText = await file.text();
  statusText.textContent = `ファイルを読み込みました: ${file.name}`;
});

sampleBtn.addEventListener("click", () => {
  logText.value = `<mjloggm ver="2.3"><UN n0="あなた" n1="A" n2="B" n3="C"/><INIT/><REACH who="0" step="1"/><REACH who="0" step="2"/><AGARI who="0" fromWho="2" ten="30,3900"/><RYUUKYOKU/></mjloggm>`;
  statusText.textContent = "天鳳サンプル牌譜を読み込みました。";
});

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  logText.value = "";
  loadedFileText = "";
  summary.innerHTML = "";
  resultCard.hidden = true;
  statusText.textContent = "入力をクリアしました。";
});

analyzeBtn.addEventListener("click", () => {
  const source = (logText.value || loadedFileText || "").trim();
  if (!source) {
    statusText.textContent = "牌譜データが空です。ファイルかテキストを用意してください。";
    resultCard.hidden = true;
    return;
  }

  try {
    const data = parseLog(source);
    renderResult(data);
    statusText.textContent = `解析完了: ${data.type} 牌譜 / ${data.rounds} 局`; 
  } catch (error) {
    statusText.textContent = `解析失敗: ${error.message}`;
    resultCard.hidden = true;
  }
});

function parseLog(source) {
  if (source.includes("<mjloggm") || source.includes("<AGARI") || source.includes("<INIT")) {
    return parseTenhou(source);
  }

  if ((source.startsWith("{") || source.startsWith("[")) && (source.includes("records") || source.includes("actions") || source.includes("rounds"))) {
    return parseMahjongSoul(source);
  }

  throw new Error("対応形式を判定できません。天鳳XMLかジャンたまJSONを入力してください。");
}

function parseTenhou(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML形式が不正です");
  }

  const rounds = doc.querySelectorAll("INIT").length;
  const agariNodes = Array.from(doc.querySelectorAll("AGARI"));
  const reachNodes = Array.from(doc.querySelectorAll("REACH[step='2']"));
  const ryukyoku = doc.querySelectorAll("RYUUKYOKU").length;

  const namesNode = doc.querySelector("UN");
  const players = [0, 1, 2, 3].map((i) => namesNode?.getAttribute(`n${i}`) || `P${i + 1}`);

  const stats = createPlayerStats(players);

  reachNodes.forEach((node) => {
    const who = Number(node.getAttribute("who"));
    if (!Number.isNaN(who) && stats[who]) stats[who].riichi += 1;
  });

  agariNodes.forEach((node) => {
    const who = Number(node.getAttribute("who"));
    const fromWho = Number(node.getAttribute("fromWho"));
    const ten = node.getAttribute("ten") || "";
    const score = Number(ten.split(",")[1]) || 0;

    if (!Number.isNaN(who) && stats[who]) {
      stats[who].wins += 1;
      stats[who].totalPoints += score;
    }

    if (!Number.isNaN(fromWho) && fromWho !== who && stats[fromWho]) {
      stats[fromWho].dealsIn += 1;
    }
  });

  return {
    type: "天鳳",
    rounds,
    ryukyoku,
    agari: agariNodes.length,
    players: stats,
  };
}

function parseMahjongSoul(jsonText) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("JSON形式が不正です");
  }

  const rounds = findArray(payload, ["rounds", "records", "actions"]).length;
  const playersFromPayload = payload?.players || payload?.accounts || payload?.seat_list || [];
  const players = normalizePlayers(playersFromPayload);
  const stats = createPlayerStats(players);

  const flatEvents = flatten(payload);

  let agari = 0;
  let ryukyoku = 0;

  flatEvents.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const type = String(item.type || item.name || item.event || "").toLowerCase();

    if (type.includes("reach") || type.includes("riichi")) {
      const who = Number(item.who ?? item.seat ?? item.actor);
      if (!Number.isNaN(who) && stats[who]) stats[who].riichi += 1;
    }

    if (type.includes("agari") || type.includes("hule") || type.includes("win")) {
      agari += 1;
      const who = Number(item.who ?? item.seat ?? item.winner);
      const fromWho = Number(item.fromWho ?? item.loser ?? item.target);
      const score = Number(item.point ?? item.score ?? item.delta ?? 0);

      if (!Number.isNaN(who) && stats[who]) {
        stats[who].wins += 1;
        stats[who].totalPoints += Math.max(0, score);
      }

      if (!Number.isNaN(fromWho) && fromWho !== who && stats[fromWho]) {
        stats[fromWho].dealsIn += 1;
      }
    }

    if (type.includes("ryuukyoku") || type.includes("draw")) {
      ryukyoku += 1;
    }
  });

  return {
    type: "ジャンたま(JSON)",
    rounds,
    ryukyoku,
    agari,
    players: stats,
  };
}

function createPlayerStats(names) {
  return names.map((name) => ({
    name,
    wins: 0,
    dealsIn: 0,
    riichi: 0,
    totalPoints: 0,
  }));
}

function normalizePlayers(source) {
  if (!Array.isArray(source) || source.length === 0) {
    return ["P1", "P2", "P3", "P4"];
  }

  return source.slice(0, 4).map((entry, index) => {
    if (typeof entry === "string") return entry;
    if (entry?.nickname) return entry.nickname;
    if (entry?.name) return entry.name;
    return `P${index + 1}`;
  });
}

function findArray(obj, keys) {
  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key];
  }
  return [];
}

function flatten(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    out.push(node);
    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") stack.push(value);
    });
  }
  return out;
}

function renderResult(data) {
  resultCard.hidden = false;

  const roundCount = data.rounds || 1;
  const common = `
    <div class="summary-item">
      <h3>全体</h3>
      <div>局数: <strong>${data.rounds}</strong></div>
      <div>和了回数: <strong>${data.agari}</strong></div>
      <div>流局回数: <strong>${data.ryukyoku}</strong></div>
      <div class="small">形式: ${data.type}</div>
    </div>
  `;

  const players = data.players
    .map((p) => {
      const riichiRate = ((p.riichi / roundCount) * 100).toFixed(1);
      const avgPoint = p.wins > 0 ? Math.round(p.totalPoints / p.wins) : 0;
      return `
        <div class="summary-item">
          <h3>${escapeHtml(p.name)}</h3>
          <div>和了: <strong>${p.wins}</strong></div>
          <div>放銃: <strong>${p.dealsIn}</strong></div>
          <div>立直: <strong>${p.riichi}</strong> (${riichiRate}%)</div>
          <div>平均打点: <strong>${avgPoint}</strong></div>
        </div>
      `;
    })
    .join("");

  summary.innerHTML = `<div class="summary-grid">${common}${players}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
