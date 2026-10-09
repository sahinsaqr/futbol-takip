/* Futbol Takip — takip edilen takımların maçları, canlı skor ve puan durumu.
   Veriler GitHub'daki Python görevinin ürettiği veri/*.json dosyalarından okunur. */
'use strict';

const DEPO = 'ft_takip';
const SEKME_DEPO = 'ft_sekme';
const durum = {
  takip: depoOku(DEPO, []),
  ligler: [],
  ligVeri: {},          // kod -> lig_*.json içeriği
  canli: null,
  sekme: depoOku(SEKME_DEPO, 'takimlar'),
  macSekme: 'yaklasan',
  puanLig: null,
  ekleLig: null,
  arama: '',
  sonYukleme: null,
  bildirimTakip: null,  // takip.json içeriği
  hata: null,
};
let yenilemeZamanlayici = null;

// ------------------------------------------------------------------ yardımcılar
function depoOku(anahtar, varsayilan) {
  try { const v = localStorage.getItem(anahtar); return v ? JSON.parse(v) : varsayilan; }
  catch { return varsayilan; }
}
function depoYaz(anahtar, deger) {
  try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch { /* gizli sekme vb. */ }
}
const kacis = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, kok = document) => kok.querySelector(s);

async function jsonGetir(yol) {
  const r = await fetch(`${yol}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${yol}: ${r.status}`);
  return r.json();
}

function tost(mesaj) {
  const k = $('#tost');
  k.textContent = mesaj;
  k.classList.add('goster');
  clearTimeout(tost.z);
  tost.z = setTimeout(() => k.classList.remove('goster'), 2200);
}

const saatBicim = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const gunBicim = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const kisaGunBicim = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });

function gunAnahtari(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function gunEtiketi(d, kisa = false) {
  const bugun = new Date();
  const fark = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
    new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate())) / 864e5);
  if (fark === 0) return 'Bugün';
  if (fark === 1) return 'Yarın';
  if (fark === -1) return 'Dün';
  return (kisa ? kisaGunBicim : gunBicim).format(d);
}
function geriSayim(d) {
  let dk = Math.round((d - Date.now()) / 60000);
  if (dk <= 0) return 'başlamak üzere';
  const gun = Math.floor(dk / 1440); dk -= gun * 1440;
  const sa = Math.floor(dk / 60); dk -= sa * 60;
  if (gun) return `${gun} gün ${sa} sa sonra`;
  if (sa) return `${sa} sa ${dk} dk sonra`;
  return `${dk} dk sonra`;
}
function goreceliZaman(iso) {
  if (!iso) return 'bilinmiyor';
  const dk = Math.round((Date.now() - new Date(iso)) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return `${Math.round(sa / 24)} gün önce`;
}

function logoHtml(takim, boyut = 'kucuk') {
  const px = { kucuk: 24, orta: 32, '': 40 }[boyut] ?? 40;
  let url = takim.logo || '';
  const m = url.match(/^https:\/\/a\.espncdn\.com(\/i\/.+\.png)/);
  if (m) url = `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${px * 2}&h=${px * 2}`;
  const bas = kacis((takim.kisa || takim.ad || '?').slice(0, 3).toUpperCase());
  const yedek = `<div class="logo ${boyut} logo-yedek" style="width:${px}px;height:${px}px">${bas}</div>`;
  if (!url) return yedek;
  return `<img class="logo ${boyut}" src="${kacis(url)}" alt="" loading="lazy" width="${px}" height="${px}"
    onerror="this.outerHTML=this.dataset.yedek" data-yedek="${kacis(yedek)}">`;
}

const takipIdler = () => new Set(durum.takip.map((t) => t.id));
const ligAdi = (kod) => durum.ligler.find((l) => l.kod === kod)?.ad || kod;

// ------------------------------------------------------------------ veri
function gerekliLigler() {
  const ids = takipIdler();
  const kodlar = new Set(durum.takip.map((t) => t.lig));
  for (const l of durum.ligler) {
    if ((l.takimlar || []).some((t) => ids.has(t.id))) kodlar.add(l.kod);
  }
  if (durum.puanLig) kodlar.add(durum.puanLig);
  return [...kodlar].filter((k) => durum.ligler.some((l) => l.kod === k));
}

async function ligYukle(kod) {
  try { durum.ligVeri[kod] = await jsonGetir(`veri/lig_${kod}.json`); }
  catch (h) { console.warn(h); }
}

async function yukle({ sessiz = false } = {}) {
  const btn = $('#yenileBtn');
  btn.classList.add('donuyor');
  try {
    const ligler = await jsonGetir('veri/ligler.json');
    durum.ligler = ligler.ligler || [];
    durum.hata = null;
  } catch (h) {
    durum.hata = 'Veriler henüz hazır değil. GitHub görevi ilk kez çalıştıktan sonra burada görünecek.';
  }
  await Promise.all([
    ...gerekliLigler().map(ligYukle),
    jsonGetir('veri/canli.json').then((c) => { durum.canli = c; }).catch(() => {}),
    jsonGetir('takip.json').then((t) => { durum.bildirimTakip = t; }).catch(() => {}),
  ]);
  durum.sonYukleme = new Date();
  btn.classList.remove('donuyor');
  ciz();
  zamanlayiciKur();
  if (!sessiz) durumSatiri();
}

function tumMaclar() {
  const maclar = new Map();
  for (const lig of Object.values(durum.ligVeri)) {
    for (const m of lig.maclar || []) maclar.set(m.id, m);
  }
  for (const m of durum.canli?.maclar || []) {
    const eski = maclar.get(m.id);
    // canlı dosya daha yeniyse onu kullan
    if (!eski || eski.durum !== 'post' || m.durum === 'post') maclar.set(m.id, { ...eski, ...m });
  }
  return [...maclar.values()].sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
}

function takimMaclari(id, maclar) {
  return maclar.filter((m) => m.ev.id === id || m.dep.id === id);
}

const ERTELENDI = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_SUSPENDED']);
function macDurumu(m) {
  if (ERTELENDI.has(m.durum_kodu)) return { tip: 'ert', yazi: 'ERT', alt: 'ertelendi' };
  if (m.durum === 'in') {
    if (m.durum_kodu === 'STATUS_HALFTIME') return { tip: 'canli', yazi: 'DA', alt: 'devre' };
    return { tip: 'canli', yazi: m.dakika || 'CANLI', alt: 'canlı' };
  }
  if (m.durum === 'post') return { tip: 'bitti', yazi: 'MS', alt: '' };
  // başlama saati geçti ama veri güncellenmemiş olabilir
  return { tip: 'once', yazi: saatBicim.format(new Date(m.tarih)), alt: '' };
}

function sonuc(m, id) {
  if (m.durum !== 'post' || m.ev_skor == null) return null;
  const biz = m.ev.id === id ? m.ev_skor : m.dep_skor;
  const onlar = m.ev.id === id ? m.dep_skor : m.ev_skor;
  return biz > onlar ? 'G' : biz < onlar ? 'M' : 'B';
}

// ------------------------------------------------------------------ çizim
function durumSatiri() {
  const s = $('#durumSatiri');
  const verisi = durum.canli?.guncelleme || Object.values(durum.ligVeri)[0]?.guncelleme;
  const canliSay = tumMaclar().filter((m) => m.durum === 'in' && ilgili(m)).length;
  const parcalar = [];
  if (canliSay) parcalar.push(`<span class="nokta"></span>${canliSay} canlı maç`);
  parcalar.push(`Veri: ${goreceliZaman(verisi)}`);
  s.innerHTML = parcalar.join(' · ');
}
const ilgili = (m) => { const ids = takipIdler(); return ids.has(m.ev.id) || ids.has(m.dep.id); };

function ciz() {
  document.querySelectorAll('.alt-menu button').forEach((b) =>
    b.classList.toggle('aktif', b.dataset.sekme === durum.sekme));
  const icerik = $('#icerik');
  const ciziciler = { takimlar: cizTakimlar, maclar: cizMaclar, puan: cizPuan, ekle: cizEkle, ayarlar: cizAyarlar };
  icerik.innerHTML = (durum.hata && durum.sekme !== 'ayarlar' ? `<div class="uyari">${kacis(durum.hata)}</div>` : '') +
    (ciziciler[durum.sekme] || cizTakimlar)();
  durumSatiri();
}

function bosEkran(baslik, metin, dugme = true) {
  return `<div class="kart bos">
    <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="currentColor" d="m12 7 3.8 2.8-1.5 4.4H9.7L8.2 9.8z"/></svg>
    <h2>${kacis(baslik)}</h2><p>${kacis(metin)}</p>
    ${dugme ? '<button class="dugme" data-git="ekle">Takım ekle</button>' : ''}
  </div>`;
}

function takimSatiri(t, skor, sinif) {
  return `<div class="taraf ${sinif}">${logoHtml(t)}<span class="isim">${kacis(t.ad)}</span>${skor == null ? '' : `<span class="skor">${skor}</span>`}</div>`;
}

function macHtml(m, { ligGoster = true } = {}) {
  const d = macDurumu(m);
  const ids = takipIdler();
  const oynandi = m.durum !== 'pre';
  let evS = '', depS = '';
  if (m.durum === 'post' && m.ev_skor != null) {
    evS = m.ev_skor > m.dep_skor ? 'kazandi' : m.ev_skor < m.dep_skor ? 'kaybetti' : '';
    depS = m.dep_skor > m.ev_skor ? 'kazandi' : m.dep_skor < m.ev_skor ? 'kaybetti' : '';
  }
  if (ids.has(m.ev.id)) evS += ' takipte';
  if (ids.has(m.dep.id)) depS += ' takipte';
  const goller = (m.goller || []).filter((g) => g.oyuncu)
    .map((g) => `${kacis(g.dk)} ${kacis(g.oyuncu)}${g.pen ? ' (P)' : ''}${g.kk ? ' (KK)' : ''}`).join(', ');
  return `<div class="mac ${d.tip === 'canli' ? 'canli' : ''}">
    <div class="saat">${d.tip === 'canli' ? '<span class="nokta"></span>' : ''}${kacis(d.yazi)}${d.alt && d.tip !== 'canli' ? `<small>${d.alt}</small>` : ''}</div>
    <div class="taraflar">
      ${takimSatiri(m.ev, oynandi ? m.ev_skor ?? 0 : null, evS)}
      ${takimSatiri(m.dep, oynandi ? m.dep_skor ?? 0 : null, depS)}
      ${goller ? `<div class="goller">⚽ ${goller}</div>` : ''}
      ${ligGoster ? `<div class="lig-etiket">${kacis(ligAdi(m.lig))}</div>` : ''}
    </div>
  </div>`;
}

function gunlereGore(maclar, ters = false) {
  const gruplar = [];
  let son = null;
  const liste = ters ? [...maclar].reverse() : maclar;
  for (const m of liste) {
    const d = new Date(m.tarih);
    const a = gunAnahtari(d);
    if (a !== son) { gruplar.push(`<div class="gun-baslik">${kacis(gunEtiketi(d))}</div>`); son = a; }
    gruplar.push(macHtml(m));
  }
  return `<div class="kart mac-listesi">${gruplar.join('')}</div>`;
}

// ---- Takımlarım
function cizTakimlar() {
  if (!durum.takip.length) return bosEkran('Henüz takım eklemedin', 'Takip etmek istediğin takımları ekle; maçları, skorları ve puan durumu burada görünsün.');
  const maclar = tumMaclar();
  const kartlar = durum.takip.map((t) => {
    const tm = takimMaclari(t.id, maclar);
    const canli = tm.find((m) => m.durum === 'in');
    const sonraki = tm.find((m) => m.durum === 'pre' && !ERTELENDI.has(m.durum_kodu) && new Date(m.tarih) > Date.now() - 3 * 3600e3);
    const bitenler = tm.filter((m) => m.durum === 'post');
    const son = bitenler[bitenler.length - 1];
    const form = bitenler.slice(-5).map((m) => sonuc(m, t.id)).filter(Boolean);
    const tablo = sira(t.id, t.lig);
    const parcalar = [];
    if (canli) {
      parcalar.push(`<div class="mini-mac canli"><div class="etiket"><span><span class="nokta"></span>Canlı · ${kacis(macDurumu(canli).yazi)}</span><span>${kacis(ligAdi(canli.lig))}</span></div>${macHtmlIc(canli)}</div>`);
    }
    if (sonraki && sonraki !== canli) {
      const d = new Date(sonraki.tarih);
      parcalar.push(`<div class="mini-mac"><div class="etiket"><span>Sıradaki · ${kacis(gunEtiketi(d, true))} ${saatBicim.format(d)}</span><span class="geri-sayim">${geriSayim(d)}</span></div>${macHtmlIc(sonraki)}</div>`);
    }
    if (son) {
      parcalar.push(`<div class="mini-mac"><div class="etiket"><span>Son maç · ${kacis(gunEtiketi(new Date(son.tarih), true))}</span><span>${kacis(ligAdi(son.lig))}</span></div>${macHtmlIc(son)}</div>`);
    }
    if (!parcalar.length) parcalar.push('<div class="mini-mac"><div class="etiket"><span>Yakın zamanda maç bulunamadı</span></div></div>');
    return `<article class="kart takim-kart">
      <div class="takim-ust">${logoHtml(t, '')}
        <div><div class="ad">${kacis(t.ad)}</div><div class="lig">${kacis(ligAdi(t.lig))}${tablo ? ` · ${tablo.sira}. sıra, ${tablo.p} puan` : ''}</div></div>
        <div class="form" title="Son maçlar">${form.map((f) => `<span class="${f}">${f}</span>`).join('')}</div>
      </div>
      ${parcalar.join('')}
    </article>`;
  });
  return `<div class="kartlar iki">${kartlar.join('')}</div>`;
}

function macHtmlIc(m) {
  // mini kart içinde: saat sütunu olmadan iki satır takım
  const oynandi = m.durum !== 'pre';
  const ids = takipIdler();
  const g = (m.goller || []).filter((x) => x.oyuncu).map((x) => `${kacis(x.dk)} ${kacis(x.oyuncu)}`).join(', ');
  return `${takimSatiri(m.ev, oynandi ? m.ev_skor ?? 0 : null, ids.has(m.ev.id) ? 'takipte' : '')}
    ${takimSatiri(m.dep, oynandi ? m.dep_skor ?? 0 : null, ids.has(m.dep.id) ? 'takipte' : '')}
    ${g ? `<div class="goller">⚽ ${g}</div>` : ''}`;
}

function sira(id, kod) {
  for (const tablo of durum.ligVeri[kod]?.tablolar || []) {
    const s = tablo.satirlar.find((x) => x.takim.id === id);
    if (s) return s;
  }
  return null;
}

// ---- Maçlar
function cizMaclar() {
  if (!durum.takip.length) return bosEkran('Maç listesi boş', 'Önce takip edeceğin takımları ekle.');
  const maclar = tumMaclar().filter(ilgili);
  const simdi = Date.now();
  const canli = maclar.filter((m) => m.durum === 'in');
  const yaklasan = maclar.filter((m) => m.durum === 'pre' && new Date(m.tarih) > simdi - 3 * 3600e3);
  const biten = maclar.filter((m) => m.durum === 'post' || (m.durum === 'pre' && ERTELENDI.has(m.durum_kodu) && new Date(m.tarih) < simdi));
  const sekmeler = `<div class="bolmeli" role="tablist">
    <button data-macsekme="yaklasan" class="${durum.macSekme === 'yaklasan' ? 'aktif' : ''}">Yaklaşan</button>
    <button data-macsekme="sonuclar" class="${durum.macSekme === 'sonuclar' ? 'aktif' : ''}">Sonuçlar</button>
  </div>`;
  let govde = '';
  if (canli.length) govde += `<h2 class="bolum-baslik"><span class="nokta"></span>Şu an oynanıyor</h2>` + gunlereGore(canli);
  if (durum.macSekme === 'yaklasan') {
    govde += `<h2 class="bolum-baslik">Yaklaşan maçlar</h2>` +
      (yaklasan.length ? gunlereGore(yaklasan.slice(0, 40)) : '<div class="kart bos">Yaklaşan maç bulunamadı.</div>');
  } else {
    govde += `<h2 class="bolum-baslik">Son sonuçlar</h2>` +
      (biten.length ? gunlereGore(biten.slice(-40), true) : '<div class="kart bos">Henüz sonuç yok.</div>');
  }
  return sekmeler + govde;
}

// ---- Puan durumu
function cizPuan() {
  if (!durum.ligler.length) return bosEkran('Puan durumu yok', 'Veriler hazır olduğunda burada görünecek.', false);
  const oncelikli = new Set(gerekliLigler());
  const sirali = [...durum.ligler].sort((a, b) => (oncelikli.has(b.kod) - oncelikli.has(a.kod)));
  if (!durum.puanLig) durum.puanLig = durum.takip[0]?.lig || sirali[0].kod;
  const kod = durum.puanLig;
  const secici = `<div class="secici">${sirali.map((l) =>
    `<button class="cip ${l.kod === kod ? 'aktif' : ''}" data-puanlig="${kacis(l.kod)}">${kacis(l.ad)}</button>`).join('')}</div>`;
  const veri = durum.ligVeri[kod];
  if (!veri) {
    ligYukle(kod).then(() => { if (durum.sekme === 'puan') ciz(); });
    return secici + '<div class="kart bos">Yükleniyor…</div>';
  }
  if (!veri.tablolar?.length) return secici + '<div class="kart bos">Bu turnuva için puan tablosu yok.</div>';
  const ids = takipIdler();
  const tablolar = veri.tablolar.map((tablo) => {
    const aciklama = new Map();
    const satirlar = tablo.satirlar.map((s) => {
      if (s.renk && s.not) aciklama.set(s.not, s.renk);
      return `<tr class="${ids.has(s.takim.id) ? 'takipte' : ''}">
        <td class="sira" style="--serit:${kacis(s.renk || 'transparent')}">${s.sira}</td>
        <td class="takim-hucre"><div class="ic">${logoHtml(s.takim)}<span class="isim">${kacis(s.takim.ad)}</span></div></td>
        <td>${s.o}</td><td class="gizle-dar">${s.g}</td><td class="gizle-dar">${s.b}</td><td class="gizle-dar">${s.m}</td>
        <td>${s.av > 0 ? '+' : ''}${s.av}</td><td class="puan-h">${s.p}</td></tr>`;
    }).join('');
    const baslik = veri.tablolar.length > 1 && tablo.ad ? `<div class="tablo-baslik">${kacis(tablo.ad)}</div>` : '';
    const acik = aciklama.size ? `<div class="aciklamalar">${[...aciklama].map(([n, r]) => `<span><i style="background:${kacis(r)}"></i>${kacis(n)}</span>`).join('')}</div>` : '';
    return `<div class="kart">${baslik}<div class="tablo-sar"><table class="puan">
      <thead><tr><th>#</th><th class="takim-hucre">Takım</th><th>O</th><th class="gizle-dar">G</th><th class="gizle-dar">B</th><th class="gizle-dar">M</th><th>AV</th><th>P</th></tr></thead>
      <tbody>${satirlar}</tbody></table></div>${acik}</div>`;
  }).join('<div style="height:12px"></div>');
  return secici + tablolar;
}

// ---- Takım ekle
function cizEkle() {
  if (!durum.ligler.length) return bosEkran('Takım listesi yok', 'Veriler hazır olduğunda takımları buradan ekleyebileceksin.', false);
  if (!durum.ekleLig) durum.ekleLig = durum.ligler[0].kod;
  const ids = takipIdler();
  const q = durum.arama.trim().toLocaleLowerCase('tr');
  let takimlar;
  if (q) {
    const gorulen = new Set();
    takimlar = [];
    for (const l of durum.ligler) for (const t of l.takimlar || []) {
      if (!gorulen.has(t.id) && t.ad.toLocaleLowerCase('tr').includes(q)) { gorulen.add(t.id); takimlar.push({ ...t, lig: l.kod }); }
    }
  } else {
    const lig = durum.ligler.find((l) => l.kod === durum.ekleLig) || durum.ligler[0];
    takimlar = (lig.takimlar || []).map((t) => ({ ...t, lig: lig.kod }));
  }
  const takipteki = durum.takip.length ? `<h2 class="bolum-baslik">Takip ettiklerin (${durum.takip.length})</h2>
    <div class="takim-izgara">${durum.takip.map((t) => takimDugme(t, true)).join('')}</div>` : '';
  return `${takipteki}
    <h2 class="bolum-baslik">Takım ekle</h2>
    <input class="arama" id="arama" type="search" placeholder="Takım ara (ör. Galatasaray, Arsenal)" value="${kacis(durum.arama)}" autocomplete="off">
    ${q ? '' : `<div class="secici">${durum.ligler.map((l) =>
      `<button class="cip ${l.kod === durum.ekleLig ? 'aktif' : ''}" data-eklelig="${kacis(l.kod)}">${kacis(l.ad)}</button>`).join('')}</div>`}
    <div class="takim-izgara" id="takimIzgara">${takimlar.length ? takimlar.map((t) => takimDugme(t, ids.has(t.id))).join('') : '<p class="bos">Sonuç bulunamadı.</p>'}</div>`;
}
function takimDugme(t, secili) {
  return `<button class="takim-sec ${secili ? 'secili' : ''}" data-takim="${kacis(t.id)}" data-lig="${kacis(t.lig)}" aria-pressed="${secili}">
    ${logoHtml(t, 'orta')}<span class="isim">${kacis(t.ad)}</span>
    <span class="isaret">${secili ? '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' : ''}</span>
  </button>`;
}

function takimDegistir(id, lig) {
  const i = durum.takip.findIndex((t) => t.id === id);
  if (i >= 0) {
    const [t] = durum.takip.splice(i, 1);
    tost(`${t.ad} listeden çıkarıldı`);
  } else {
    const l = durum.ligler.find((x) => x.kod === lig);
    const t = l?.takimlar.find((x) => x.id === id);
    if (!t) return;
    durum.takip.push({ id: t.id, ad: t.ad, kisa: t.kisa, logo: t.logo, lig });
    tost(`${t.ad} eklendi`);
    // bu takımın liglerini yükle
    Promise.all(gerekliLigler().filter((k) => !durum.ligVeri[k]).map(ligYukle)).then(() => ciz());
  }
  depoYaz(DEPO, durum.takip);
  ciz();
  const a = $('#arama');
  if (a && durum.arama) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); }
}

// ---- Bildirim ayarları
function depoAdresi() {
  const h = location.hostname;
  if (!h.endsWith('.github.io')) return null;
  const sahip = h.replace('.github.io', '');
  const ilk = location.pathname.split('/').filter(Boolean)[0];
  const depo = ilk && !ilk.includes('.') ? ilk : h;
  return `https://github.com/${sahip}/${depo}`;
}
function cizAyarlar() {
  const icerik = JSON.stringify({
    aciklama: 'Bildirim gelmesini istedigin takimlar. Uygulamadaki Bildirim sekmesinden hazir listeyi kopyalayip buraya yapistirabilirsin.',
    bildirim_takimlari: durum.takip.map((t) => ({ id: t.id, ad: t.ad })),
  }, null, 2);
  const mevcut = (durum.bildirimTakip?.bildirim_takimlari || []);
  const mevcutIds = new Set(mevcut.map((t) => String(t.id)));
  const ayni = mevcut.length === durum.takip.length && durum.takip.every((t) => mevcutIds.has(t.id));
  const depo = depoAdresi();
  return `
    <h2 class="bolum-baslik">Şu an bildirim gelen takımlar</h2>
    <div class="kart adimlar"><p>${mevcut.length ? mevcut.map((t) => `<b>${kacis(t.ad)}</b>`).join(', ') : 'Henüz yok.'}</p>
      ${!ayni && durum.takip.length ? '<p class="uyari" style="margin:8px 0 0">Uygulamadaki listen ile bildirim listesi farklı. Aşağıdaki 2. adımla güncelleyebilirsin.</p>' : ''}
    </div>

    <h2 class="bolum-baslik">Bildirimleri kurma</h2>
    <div class="kart adimlar"><ol>
      <li><b>ntfy uygulamasını kur</b> (iPhone: App Store, Android: Play Store). Uygulamada <b>+</b> ile, GitHub'a <code>NTFY_KONU</code> olarak girdiğin konu adına abone ol.</li>
      <li><b>Takım listesini güncelle:</b> aşağıdaki metni kopyala, GitHub'daki <code>takip.json</code> dosyasının içeriğiyle değiştir ve kaydet (Commit).
        <div class="kod" id="takipMetni">${kacis(icerik)}</div>
        <div class="satir-dugmeler">
          <button class="dugme" id="kopyalaBtn">Kopyala</button>
          ${depo ? `<a class="dugme ikincil" href="${kacis(depo)}/edit/main/takip.json" target="_blank" rel="noopener">GitHub'da düzenle</a>` : ''}
        </div>
      </li>
      <li>Hepsi bu. Takımının maçı yaklaşınca GitHub görevi maçı izler; maç başlangıcı, gol, devre arası ve maç sonu bildirim olarak telefonuna gelir.</li>
    </ol></div>

    <h2 class="bolum-baslik">Uygulama hakkında</h2>
    <div class="kart adimlar">
      <p>Veriler ESPN'den, GitHub'da çalışan Python görevi tarafından çekilir. Fikstür ve puan durumu birkaç saatte bir, maç sırasında skor dakikada bir güncellenir.</p>
      <p>Son veri: ${kacis(goreceliZaman(durum.canli?.guncelleme || Object.values(durum.ligVeri)[0]?.guncelleme))}</p>
      ${depo ? `<p><a href="${kacis(depo)}/actions" target="_blank" rel="noopener">GitHub görevlerini görüntüle</a></p>` : ''}
    </div>`;
}

// ------------------------------------------------------------------ olaylar
document.addEventListener('click', (e) => {
  const h = e.target.closest('button, a');
  if (!h) return;
  if (h.dataset.sekme || h.dataset.git) {
    durum.sekme = h.dataset.sekme || h.dataset.git;
    depoYaz(SEKME_DEPO, durum.sekme);
    ciz();
    window.scrollTo({ top: 0 });
  } else if (h.dataset.macsekme) { durum.macSekme = h.dataset.macsekme; ciz(); }
  else if (h.dataset.puanlig) { durum.puanLig = h.dataset.puanlig; ciz(); }
  else if (h.dataset.eklelig) { durum.ekleLig = h.dataset.eklelig; ciz(); }
  else if (h.dataset.takim) takimDegistir(h.dataset.takim, h.dataset.lig);
  else if (h.id === 'yenileBtn') yukle();
  else if (h.id === 'kopyalaBtn') {
    const metin = $('#takipMetni').textContent;
    (navigator.clipboard?.writeText(metin) || Promise.reject()).then(
      () => tost('Kopyalandı'),
      () => { const r = document.createRange(); r.selectNodeContents($('#takipMetni')); getSelection().removeAllRanges(); getSelection().addRange(r); tost('Metni seçip kopyala'); });
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'arama') return;
  durum.arama = e.target.value;
  const kaydir = window.scrollY;
  ciz();
  const a = $('#arama');
  a.focus(); a.setSelectionRange(a.value.length, a.value.length);
  window.scrollTo({ top: kaydir });
});

// Canlı maç varsa dakikada bir, yoksa 15 dakikada bir yenile
function zamanlayiciKur() {
  clearTimeout(yenilemeZamanlayici);
  const simdi = Date.now();
  const sicak = tumMaclar().some((m) => ilgili(m) && (m.durum === 'in' ||
    (m.durum === 'pre' && Math.abs(new Date(m.tarih) - simdi) < 30 * 60e3)));
  yenilemeZamanlayici = setTimeout(() => yukle({ sessiz: true }), sicak ? 60e3 : 15 * 60e3);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (!durum.sonYukleme || Date.now() - durum.sonYukleme > 60e3)) yukle({ sessiz: true });
});
setInterval(() => { if (document.visibilityState === 'visible' && durum.sekme === 'takimlar') ciz(); }, 60e3);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

ciz();
yukle();
