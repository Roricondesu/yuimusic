// 临时测试脚本：验证歌词匹配流程
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\s]/g, ' ')
    .replace(/[\s\-_]+/g, ' ')
    .trim();

const lev = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = [];
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = temp;
    }
  }
  return dp[n];
};

const lcs = (a, b) => {
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let p = new Array(n + 1).fill(0), c = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) c[j] = a[i - 1] === b[j - 1] ? p[j - 1] + 1 : Math.max(p[j], c[j - 1]);
    [p, c] = [c, p];
  }
  return p[n];
};

const similarity = (a, b) => {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const wa = na.split(' ').filter(Boolean), wb = nb.split(' ').filter(Boolean);
  const sa = new Set(wa), sb = new Set(wb);
  const inter = [...sa].filter(x => sb.has(x)).length;
  const un = new Set([...sa, ...sb]);
  const jac = un.size ? inter / un.size : 0;
  const ml = Math.max(na.length, nb.length);
  const edit = ml ? 1 - lev(na, nb) / ml : 0;
  const lcsv = ml ? lcs(na, nb) / ml : 0;
  return jac * 0.4 + Math.max(0, edit) * 0.35 + lcsv * 0.25;
};

const buildSearchQueries = (artist, title) => {
  const queries = [];
  const a = artist.trim(), t = title.trim();
  const tNoParen = t.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
  const aNoParen = a.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
  if (a && t) queries.push(`${a} ${t}`);
  if (a && t && a !== t) queries.push(`${t} ${a}`);
  if (aNoParen && tNoParen && `${aNoParen} ${tNoParen}` !== `${a} ${t}`) queries.push(`${aNoParen} ${tNoParen}`);
  if (t) queries.push(t);
  if (tNoParen && tNoParen !== t) queries.push(tNoParen);
  if (a) queries.push(a);
  return [...new Set(queries)].slice(0, 6);
};

const MB_USER_AGENT = 'LiquidGlassMusic/0.2 (hello@liquidglass.app)';

async function fetchMusicBrainzWorkAliases(artist, title) {
  if (!artist.trim() || !title.trim()) return [];
  const url = `https://musicbrainz.org/ws/2/work/?query=%28work:${encodeURIComponent(title)}%20OR%20alias:${encodeURIComponent(title)}%29%20AND%20artist:${encodeURIComponent(artist)}&fmt=json&limit=3`;
  const res = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
  if (!res.ok) return [];
  const data = await res.json();
  const works = data.works || [];
  if (works.length === 0) return [];
  const best = works.reduce((max, w) => (w.score > max.score ? w : max), works[0]);
  const aliases = (best.aliases || []).map(a => a.name).filter(n => normalize(n) !== normalize(title));
  return [...new Set([best.title, ...aliases])].slice(0, 6);
}

const NETEASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://music.163.com/',
  'Accept': 'application/json, text/plain, */*',
};

async function searchNetease(q) {
  const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(q)}&type=1&limit=30&offset=0`;
  const res = await fetch(url, { headers: NETEASE_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return data.result?.songs || [];
}

function pickBest(songs, artist, title, durationSec, titleAliases = []) {
  if (songs.length === 0) return null;
  const normArtist = normalize(artist);
  const allTitles = [title, ...titleAliases];
  const trackDurationMs = (durationSec || 240) * 1000;
  const hasArtist = Boolean(artist.trim());
  const scored = songs.map(s => {
    const titleSim = Math.max(...allTitles.map(t => similarity(s.name, t)));
    const artistNames = s.artists?.map(a => a.name).join(' ') || '';
    const artistSim = hasArtist ? similarity(artistNames, artist) : 0;
    const aliasSim = s.alias?.length ? Math.max(...s.alias.map(a => similarity(a, title))) : 0;
    const durationDiff = Math.abs((s.duration || 0) - trackDurationMs);
    const durationMatch = s.duration > 0 && durationDiff / Math.max(s.duration, 1) < 0.15 ? 0.15 : 0;
    const exactTitle = allTitles.some(t => normalize(s.name) === normalize(t)) ? 0.15 : 0;
    const exactArtist = hasArtist && s.artists?.some(a => normalize(a.name) === normArtist) ? 0.1 : 0;
    const titleOrAlias = Math.max(titleSim, aliasSim);
    let score = titleOrAlias * 0.6 + artistSim * 0.3 + durationMatch + exactTitle + exactArtist;
    if (titleOrAlias >= 0.95 && hasArtist && artistSim < 0.3) {
      score *= 0.75;
    }
    return { song: s, score, titleSim, artistSim };
  });
  scored.sort((a, b) => b.score - a.score);
  console.log('Top 3 candidates:');
  scored.slice(0, 3).forEach((x, i) => {
    console.log(`  ${i + 1}. ${x.song.name} / ${x.song.artists.map(a => a.name).join(', ')} score=${x.score.toFixed(3)} titleSim=${x.titleSim.toFixed(3)} artistSim=${x.artistSim.toFixed(3)}`);
  });
  const best = scored[0];
  if (!best) return null;
  if (best.score >= 0.3) return best.song;
  if (best.titleSim >= 0.5 || best.artistSim >= 0.5) return best.song;
  return null;
}

async function test(artist, title, duration) {
  console.log(`\n=== Test: ${artist} - ${title} ===`);
  const queries = buildSearchQueries(artist, title);
  console.log('Queries:', queries);

  const [aliases] = await Promise.all([
    fetchMusicBrainzWorkAliases(artist, title),
  ]);
  console.log('MB aliases:', aliases);

  const aliasQueries = aliases
    .flatMap(a => buildSearchQueries(artist, a))
    .filter((q, i, arr) => arr.indexOf(q) === i);
  const allQueries = [...new Set([...queries, ...aliasQueries])].slice(0, 10);
  console.log('All queries:', allQueries);

  const allSongs = [];
  for (const q of allQueries) {
    const songs = await searchNetease(q);
    allSongs.push(...songs);
  }
  const unique = allSongs.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
  console.log(`Total unique songs: ${unique.length}`);

  const best = pickBest(unique, artist, title, duration, aliases);

  if (best) {
    console.log('BEST MATCH:', best.id, best.name, best.artists.map(a => a.name).join(', '));
    const lyricRes = await fetch(`https://music.163.com/api/song/lyric?id=${best.id}&lv=1&kv=1&tv=-1`, { headers: NETEASE_HEADERS });
    const lyricData = await lyricRes.json();
    const lrc = lyricData.lrc?.lyric;
    console.log('Lyric found:', lrc ? 'YES (' + lrc.split('\n').length + ' lines)' : 'NO');
  } else {
    console.log('NO MATCH');
  }
}

(async () => {
  await test('LiSA', 'Gurenge', 236);
  await test('LiSA', '紅蓮華', 236);
  await test('Avicii', 'Wake Me Up', 249);
  await test('Aimer', '残響散歌', 190);
})();
