const CFG = {
  tile: 12, cols: 300, rows: 200,
  year: 300,
  maxPeople: 2600,
  adultAge: 16,
  workTicks: 90,
  houseCap: 4,
  eat: 0.25,
  prisonPop: 10, wallPop: 16, keepPop: 40,
  maxSettlements: 9,
  walk: 0.7,
};

const STATS = [
  ['str', 'Güç', 'Savaş hasarı, odun ve taş verimi'],
  ['spd', 'Hız', "Yürüme hızı"],
  ['int', 'Zeka', 'İnşaat hızı, tarım verimi, komutanın taktik seçimi'],
  ['cha', 'Karizma', 'Diplomasi, ticaret kazancı, tahta seçilme'],
  ['end', 'Dayanıklılık', 'Can ve hasara direnç'],
  ['fert', 'Doğurganlık', "Çocuk sahibi olma olasılığı"],
  ['agg', 'Saldırganlık', 'Savaş ilan etme ve suç işleme eğilimi'],
];

const RACES = {
  human: { name: "İnsan", skin: "#e0ac69", size: 1, ears: 'none', extra: 'none', home: "grass", names: 'human', kword: 'Krallığı',
    stats: { str: 5, spd: 5, int: 6, cha: 6, end: 5, fert: 6, agg: 5, life: 70 },
    info: 'Her işe uyum sağlayan, hızlı çoğalan ve hırslı bir ırk. Kısa ömürlerini büyük krallıklar kurarak telafi ederler.' },
  elf: { name: 'Elf', skin: '#f3dcc0', size: 0.95, ears: 'pointy', extra: 'none', home: 'forest', names: 'elf', kword: "Krallığı",
    stats: { str: 4, spd: 7, int: 8, cha: 7, end: 4, fert: 3, agg: 3, life: 300 },
    info: "Ormanlarda yaşayan, uzun ömürlü ve zarif bir ırk. Az çoğalırlar ama bilge ve çeviktirler. Ormanda hızlı yürürler." },
  dwarf: { name: 'Cüce', skin: '#d39b7a', size: 0.8, ears: 'none', extra: 'beard', home: 'hills', names: 'dwarf', kword: 'Dağ Krallığı',
    stats: { str: 7, spd: 3, int: 6, cha: 4, end: 9, fert: 4, agg: 5, life: 250 },
    info: 'Tepelerde ve dağlarda yaşayan, dayanıklı ve inatçı madenciler. Dağda yavaşlamazlar. Uzun sakalları onurlarıdır.' },
  orc: { name: 'Ork', skin: '#6f9a3c', size: 1.15, ears: 'small', extra: 'tusks', home: 'grass', names: 'orc', kword: 'Klanı',
    stats: { str: 9, spd: 5, int: 3, cha: 3, end: 7, fert: 8, agg: 9, life: 50 },
    info: 'Güçlü, saldırgan ve hızlı çoğalan savaşçılar. Diplomasiden çok savaşı severler. Alt çenelerinden dişleri fırlar.' },
  halfling: { name: 'Buçukluk', skin: "#eec39a", size: 0.65, ears: 'small', extra: 'none', home: 'grass', names: 'small', kword: 'Beyliği',
    stats: { str: 3, spd: 5, int: 6, cha: 8, end: 5, fert: 7, agg: 1, life: 120 },
    info: 'Küçük, neşeli ve barışçıl çiftçiler. Yemeği, bahçeyi ve rahatı severler. Savaştan kaçınırlar.' },
  gnome: { name: 'Gnom', skin: '#f0c8a0', size: 0.6, ears: 'small', extra: "hat", home: 'hills', names: 'small', kword: 'Cumhuriyeti',
    stats: { str: 3, spd: 5, int: 9, cha: 6, end: 4, fert: 5, agg: 2, life: 200 },
    info: 'Meraklı mucitler ve zanaatkârlar. Küçük ama çok zekidirler. Sivri şapkaları uzaktan bile tanınır.' },
  tiefling: { name: 'Tiefling', skin: '#b8474f', size: 1, ears: 'pointy', extra: 'horns', home: 'grass', names: 'infernal', kword: "Hanedanı",
    stats: { str: 5, spd: 6, int: 7, cha: 8, end: 5, fert: 4, agg: 6, life: 90 },
    info: 'Kökeni karanlık güçlere dayanan boynuzlu bir ırk. Güvensizlikle karşılanırlar ama zeki ve karizmatiktirler.' },
  dragonborn: { name: 'Ejderdoğan', skin: '#b0703c', size: 1.25, ears: 'none', extra: 'snout', home: 'hills', names: 'dragon', kword: 'İmparatorluğu',
    stats: { str: 8, spd: 5, int: 5, cha: 6, end: 8, fert: 3, agg: 6, life: 80 },
    info: 'Ejderha soyundan gelen, pullu, iri ve onurlu savaşçılar. Uzun burunlu yüzleri ejderhayı andırır.' },
  halfelf: { name: 'Yarı-Elf', skin: '#ead0b0', size: 1, ears: 'small', extra: "none", home: 'forest', names: 'elf', kword: 'Krallığı',
    stats: { str: 5, spd: 6, int: 7, cha: 8, end: 5, fert: 5, agg: 4, life: 150 },
    info: "İnsan ve elf kanını taşıyan, iki dünya arasında köprü kuran diplomatlar. İnsanla elf evlenirse doğarlar." },
  halforc: { name: 'Yarı-Ork', skin: '#8faa6a', size: 1.1, ears: "small", extra: 'tusks', home: 'grass', names: 'orc', kword: 'Klanı',
    stats: { str: 8, spd: 5, int: 5, cha: 4, end: 7, fert: 6, agg: 7, life: 65 },
    info: 'İnsan ve ork kanından gelen güçlü savaşçılar. İnsanla ork evlenirse doğarlar.' },
  goblin: { name: 'Goblin', skin: '#8db43a', size: 0.6, ears: 'big', extra: "none", home: 'forest', names: 'goblin', kword: 'Kabilesi',
    stats: { str: 3, spd: 7, int: 4, cha: 2, end: 3, fert: 9, agg: 8, life: 40 },
    info: 'Küçük, kurnaz ve kalabalık yağmacılar. Tek başlarına zayıftırlar ama sayıca çok fazladırlar.' },
};
for (const k in RACES) RACES[k].base = k;

const NAMES = {
  human: [['Al', 'Bar', 'Ced', 'Dor', "Ed", "Fin", 'Gar', 'Hal', 'Ir', 'Jon', 'Ker', 'Lor', "Mar", 'Ned', 'Os', 'Per', 'Ric', 'Sam', 'Tom', 'Wil'], ['an', 'en', 'ric', 'ton', "win", 'ard', 'mund', 'ia', 'a', 'el', 'is']],
  elf: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Leg', 'Mir', 'Nae', 'Syl', 'Tha', 'Ari', 'Cel', 'Eru', 'Lin'], ['dor', 'wen', 'iel', 'ion', 'las', 'riel', 'thas', 'lia', 'nor']],
  dwarf: [['Bal', 'Dur', 'Gim', 'Thor', 'Bof', 'Dwa', 'Kaz', 'Mor', 'Grim', 'Brom', 'Hel'], ["in", 'li', 'ek', 'grim', 'dun', "rak", 'bur', 'dis']],
  orc: [['Gro', 'Mog', 'Ug', 'Thr', 'Gash', 'Kru', 'Zug', 'Bol', 'Nar', 'Dur', 'Ska'], ['ak', 'ug', 'ash', 'gor', 'nak', 'muk', 'rag', 'za']],
  small: [['Bil', 'Fro', 'Pip', 'Mer', 'Sam', 'Ros', 'Nim', 'Fiz', 'Bim', 'Tob', 'Wil'], ['bo', 'do', 'pin', 'wick', "ble", 'kin', 'la', 'mo']],
  infernal: [['Ak', 'Mal', 'Zar', 'Nem', 'Kri', 'Lev', 'Mor', 'Bel', 'Ist'], ['eth', 'ira', 'os', 'ius', 'ara', 'eon', 'ith']],
  dragon: [['Ar', 'Bal', "Kri", 'Med', 'Rho', 'Sor', 'Tor', 'Dra', 'Vex'], ['ash', 'jhan', 'nar', 'gar', "thos", 'zar', 'rinn']],
  goblin: [['Snik', 'Grub', 'Zit', 'Nob', 'Rik', 'Skab', 'Gik', 'Mug'], ['', 'le', 'ik', 'nit', 'go']],
};
const PLACE_END = ['ia', 'dor', 'heim', 'burg', 'ford', 'vale', 'grad', 'mar', 'hold', 'wick'];

const KCOLORS = ['#e63946', '#3a86ff', '#f4a261', '#2a9d8f', '#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#8d6e63', '#ff6d00', "#76c893", '#b5179e', '#ffffff', '#1d3557'];

const BLDG = {
  granary: { name: 'Ambar', icon: '🌾', pop: 12, wood: 30, stone: 0, gold: 0, cost: 120, info: 'daha çok yiyecek depolanır, kıtlık hafifler' },
  tavern: { name: "Meyhane", icon: "🍺", pop: 14, wood: 25, stone: 0, gold: 10, cost: 100, info: "halk burada içip sohbet eder (bazen kavga), huzur +4" },
  market: { name: 'Pazar', icon: '🏪', pop: 18, wood: 35, stone: 0, gold: 40, cost: 150, info: 'her yıl hazineye vergi, huzur +5' },
  temple: { name: "Tapınak", icon: '⛪', pop: 22, wood: 10, stone: 40, gold: 60, cost: 250, info: 'huzur +15, isyan azalır' },
  monument: { name: 'Anıt', icon: '🗿', pop: 45, wood: 0, stone: 150, gold: 200, cost: 400, info: 'hükümdarın dev heykeli, huzur +6' },
  barracks: { name: 'Kışla', icon: '🛡', pop: 26, wood: 30, stone: 40, gold: 30, cost: 200, info: 'buranın askerleri daha sert vurur' },
};
const AGES = [
  { name: 'Taş Çağı', need: 0, helm: '#8a6a4a' }, { name: 'Tunç Çağı', need: 120, helm: '#b87333' },
  { name: 'Demir Çağı', need: 450, helm: '#a0a6ad' }, { name: 'Çelik Çağı', need: 1200, helm: '#dfe5ec' },
  { name: 'Büyü Çağı', need: 2600, helm: "#8ecae6" },
];
const techMul = k => 1 + (k.tech || 0) * 0.1;

const JOBS = { child: 'Çocuk', farmer: 'Çiftçi', wood: 'Oduncu', miner: "Madenci", builder: 'İnşaatçı', guard: 'Bekçi',
  soldier: 'Asker', archer: 'Okçu', cavalry: 'Süvari', artillery: 'Topçu', merchant: 'Tüccar', king: "Hükümdar", wanderer: 'Gezgin', hunter: 'Avcı', fisher: 'Balıkçı', healer: 'Şifacı', spear: 'Mızrakçı', shield: 'Kalkanlı', medic: 'Sedyeci' };

const LIKES = {
  'elf-halfelf': 30, 'elf-human': 10, 'human-halfelf': 20, 'human-halfling': 20, 'dwarf-gnome': 25, 'dwarf-human': 5,
  'halfling-gnome': 20, 'orc-halforc': 30, 'orc-goblin': 15, 'human-halforc': 0, 'elf-dwarf': -20, 'elf-orc': -50,
  'dwarf-orc': -45, 'dwarf-goblin': -40, 'human-orc': -25, 'goblin-halfling': -30, 'goblin-gnome': -30, 'elf-goblin': -40,
  'tiefling-dragonborn': -10, 'human-tiefling': -10, 'dragonborn-dwarf': 10,
};
function affinity(a, b) { return a === b ? 25 : LIKES[a + '-' + b] ?? LIKES[b + '-' + a] ?? -5; }
const HYBRID = { 'elf+human': 'halfelf', 'human+orc': 'halforc' };

const MEET_GOOD = ['sınır anlaşmazlıkları çözüldü', 'hediyeler değiş tokuş edildi', 'ortak bir şölen düzenlendi', 'evlilik ittifakı konuşuldu', "ticaret yolları planlandı"];
const MEET_BAD = ['elçiye hakaret edildi', 'toprak talepleri reddedildi', 'görüşme tartışmayla bitti', 'casusluk suçlamaları yapıldı', 'vergi anlaşmazlığı çıktı'];
const WAR_REASONS = ['toprak hırsı', 'hükümdara yapılan hakaret', 'ticaret yollarının kontrolü', 'eski bir kan davası', 'zenginliği kıskanma'];

const rnd = (a, b) => a + Math.random() * (b - a);

const pick = arr => arr[Math.random() * arr.length | 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function makeName(set)
{
  const [a, b] = NAMES[set] || NAMES.human;
  return pick(a) + pick(b);
}
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbCss = c => `rgb(${c.map(v => clamp(v, 0, 255) | 0)})`;
const mixHex = (a, b, t) => { const x = hexRGB(a), y = hexRGB(b); return rgbCss(x.map((v, i) => v + (y[i] - v) * t)); };
