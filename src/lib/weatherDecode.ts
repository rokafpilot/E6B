export interface DecodedLine {
  label: string;
  value: string;
}

const CLOUD: Record<string, string> = {
  FEW:'FEW 1-2', SCT:'SCT 3-4', BKN:'BKN 5-7', OVC:'OVC 8',
  NSC:'NSC', CAVOK:'CAVOK', VV:'VV', SKC:'SKC', CLR:'CLR',
};

const WX: Record<string, string> = {
  DZ:'DZ', RA:'RA', SN:'SN', SG:'SG', IC:'IC', PL:'PL', GR:'GR',
  GS:'GS', BR:'BR', FG:'FG', FU:'FU', VA:'VA', DU:'DU', SA:'SA',
  HZ:'HZ', SH:'SH', TS:'TS', FZ:'FZ', MI:'MI', BC:'BC', BL:'BL',
  DR:'DR', PR:'PR', VC:'VC', RE:'RE', PO:'PO', SQ:'SQ', FC:'FC',
  SS:'SS', DS:'DS',
};

function int(s: string): number { return parseInt(s, 10); }

function fmtTime(d: string): string {
  return /^\d{6}$/.test(d) ? `${d.slice(0,2)}d${d.slice(2,4)}:${d.slice(4)}Z` : d+'Z';
}

function fmtWind(dir: string, spd: string, gust?: string, u='KT'): string {
  if (dir === 'VRB') return `VRB ${spd}${u}${gust ? ` G${gust}` : ''}`;
  const d = int(dir);
  const r = ['N','NE','E','SE','S','SW','W','NW'][Math.round(((d%360)/45))%8];
  return `${r}${d}° ${spd}${u}${gust ? ` G${gust}` : ''}`;
}

function fmtVis(v: string): string {
  if (v === '9999') return '10km+';
  if (v === '0000') return '<50m';
  if (/^\d{4}$/.test(v)) {
    const m = int(v);
    return m >= 1000 ? `${(m/1000).toFixed(m%1000?1:0)}km` : `${m}m`;
  }
  return v;
}

function fmtCld(t: string): string | null {
  if (CLOUD[t]) return CLOUD[t];
  const m = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU|TS)?$/);
  if (!m) return null;
  const [, amt, h, tp] = m;
  return `${CLOUD[amt] ?? amt} ${int(h)*100}ft${tp ? ` ${tp}` : ''}`;
}

function fmtWx(t: string): string | null {
  if (!/^[+-]?(VC|RE)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS|UP)$/.test(t)) return null;
  const p = t.startsWith('-') ? '-' : t.startsWith('+') ? '+' : '';
  const core = t.replace(/^[+-]/, '');
  const out: string[] = [];
  for (let i = 0; i < core.length; i += 2) {
    const k = core.slice(i, i+2);
    if (WX[k]) out.push(WX[k]);
  }
  return p + out.join(' ');
}

export function decodeMetar(r0: string): DecodedLine[] {
  const L: DecodedLine[] = [];
  if (!r0) return [{ label:'ERR', value:'No METAR' }];
  const raw = r0.replace(/\s+/g, ' ').trim();
  const tk = raw.split(' ');
  L.push({ label:'RAW', value: raw.length>50 ? raw.slice(0,48)+'…' : raw });
  let i = 0;
  if (tk[i]==='METAR' || tk[i]==='SPECI') { L.push({ label:'TYPE', value: tk[i] }); i++; }
  if (/^[A-Z]{4}$/.test(tk[i])) { L.push({ label:'STA', value: tk[i] }); i++; }
  if (/^\d{6}Z$/.test(tk[i])) { L.push({ label:'TIME', value: fmtTime(tk[i].slice(0,6)) }); i++; }
  if (tk[i]==='AUTO') { L.push({ label:'MOD', value:'AUTO' }); i++; }
  if (tk[i]==='COR') { L.push({ label:'MOD', value:'COR' }); i++; }
  const wm = tk[i]?.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/);
  if (wm) {
    L.push({ label:'WND', value: fmtWind(wm[1], wm[2], wm[3], wm[4]) });
    i++;
    const vr = tk[i]?.match(/^(\d{3})V(\d{3})$/);
    if (vr) { L.push({ label:'VRB', value:`${vr[1]}↔${vr[2]}` }); i++; }
  }
  if (tk[i]==='CAVOK') { L.push({ label:'V+C', value:'CAVOK' }); i++; }
  else if (/^\d{4}$/.test(tk[i]) || tk[i]?.endsWith('SM') || tk[i]==='////') {
    L.push({ label:'VIS', value: fmtVis(tk[i]) }); i++;
    if (/^\d{4}[NSEW]$/.test(tk[i])) i++;
    if (tk[i]?.startsWith('R') && tk[i].includes('/')) { L.push({ label:'RVR', value: tk[i] }); i++; }
    while (tk[i] && fmtWx(tk[i])) { L.push({ label:'WX', value: fmtWx(tk[i])! }); i++; }
    let cc = 0;
    while (tk[i] && fmtCld(tk[i])) { cc++; L.push({ label: cc>1?`CL${cc}`:'CLD', value: fmtCld(tk[i])! }); i++; }
    if (CLOUD[tk[i]]) { L.push({ label:'CLD', value: CLOUD[tk[i]] }); i++; }
  }
  const td = tk[i]?.match(/^(M?\d{2})\/(M?\d{2})$/);
  if (td) {
    const t = int(td[1].replace('M','-')), d = int(td[2].replace('M','-'));
    const rh = Math.round(100 * Math.exp((17.625*d)/(243.04+d)) / Math.exp((17.625*t)/(243.04+t)));
    L.push({ label:'T/DP', value: `${t}/${d}°C RH${rh}%` });
    i++;
  }
  const q = tk[i]?.match(/^Q(\d{4})|^A(\d{4})$/);
  if (q) { L.push({ label:'ALT', value: q[1] ? `Q${q[1]}` : `A${q[2]}` }); i++; }
  if (tk[i]==='RMK') { const r = tk.slice(i+1).join(' '); if (r) L.push({ label:'RMK', value: r.length>44 ? r.slice(0,42)+'…' : r }); }
  if (tk[i]==='NOSIG') L.push({ label:'TRE', value:'NOSIG' });
  if (tk[i]==='BECMG') L.push({ label:'BEC', value: tk.slice(i).join(' ').slice(0,48) });
  if (tk[i]==='TEMPO') L.push({ label:'TMP', value: tk.slice(i).join(' ').slice(0,48) });
  return L;
}

export function decodeTaf(r0: string): DecodedLine[] {
  const L: DecodedLine[] = [];
  if (!r0) return [{ label:'ERR', value:'No TAF' }];
  const raw = r0.replace(/\s+/g,' ').trim();
  L.push({ label:'RAW', value: raw.length>50 ? raw.slice(0,48)+'…' : raw });
  const tk = raw.split(' ');
  let i = 0;
  if (tk[i]==='TAF') { L.push({ label:'TYP', value:'TAF' }); i++; }
  if (tk[i]==='AMD') { L.push({ label:'MOD', value:'AMD' }); i++; }
  if (/^[A-Z]{4}$/.test(tk[i])) { L.push({ label:'STA', value: tk[i] }); i++; }
  if (/^\d{6}Z$/.test(tk[i])) { L.push({ label:'TIME', value: fmtTime(tk[i].slice(0,6)) }); i++; }
  const vl = tk[i]?.match(/^(\d{4})\/(\d{4})$/);
  if (vl) { L.push({ label:'VAL', value: `${vl[1]}→${vl[2]}` }); i++; }
  const mk = ['TEMPO','BECMG','INTER','FM','PROB','RMK'];
  while (i < tk.length) {
    if (tk[i]==='RMK') { L.push({ label:'RMK', value: tk.slice(i+1).join(' ').slice(0,48) }); break; }
    let j = i, hd: string[] = [];
    while (j < tk.length && !mk.some(m => m && tk[j].startsWith(m))) { hd.push(tk[j]); j++; }
    let lab = 'FCST';
    if (tk[i]==='TEMPO') lab='TMP';
    else if (tk[i]==='BECMG') lab='BEC';
    else if (tk[i]==='INTER') lab='INT';
    else if (tk[i]?.startsWith('FM')) lab=`FM${tk[i].slice(2)}`;
    else if (tk[i]?.startsWith('PROB')) lab=`${tk[i]}%`;
    const out = [...hd];
    while (j<tk.length && !['TEMPO','BECMG','INTER','RMK'].includes(tk[j]) && !tk[j].startsWith('FM') && !tk[j].startsWith('PROB')) {
      out.push(tk[j]); j++;
    }
    const bd = out.join(' ');
    if (bd) L.push({ label: lab, value: bd.length>46 ? bd.slice(0,44)+'…' : bd });
    if (j === i) break;
    i = j;
  }
  return L;
}

export function decodeAtis(r0: string): DecodedLine[] {
  const L: DecodedLine[] = [];
  if (!r0) return [{ label:'ERR', value:'No ATIS' }];
  const rs = r0.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  L.push({ label:'ATIS', value: rs[0].length>48 ? rs[0].slice(0,46)+'…' : rs[0] });
  for (let k=1, s=0; k<rs.length && s<10; k++) {
    const ln = rs[k];
    if (!ln) continue;
    const lc = ln.toLowerCase();
    let lab = `#${k}`;
    if (/info|letter/.test(lc)) lab='LET';
    else if (/time|utc|zulu/.test(lc)) lab='TIME';
    else if (/wind|kt\b|mps\b/.test(lc)) lab='WND';
    else if (/vis|meter|km\b|sm\b/.test(lc)) lab='VIS';
    else if (/cloud|few|sct|bkn|ovc|cavok/.test(lc)) lab='CLD';
    else if (/dew|temp/.test(lc)) lab='T/DP';
    else if (/qnh|altimeter|^q\d{4}|^a\d{4}/.test(ln)) lab='ALT';
    else if (/transition|trl/.test(lc)) lab='TRL';
    else if (/runway|rwy|ldg|dep/.test(lc)) lab='RWY';
    const v = ln.length>48 ? ln.slice(0,46)+'…' : ln;
    L.push({ label: lab, value: v });
    s++;
  }
  return L;
}
