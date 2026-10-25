// Starting data for the Yug Creation live test.
// Stock figures and swatch photos come from the stock PDF dated 16 Oct 2026 (1 TP = 100 m).
// Trader names, addresses and logins are sample data for testing only.

const C = { firozi: '#1FA3A6', mango: '#E9A21B', pink: '#E78BB0', lemon: '#D9D32A', fanta: '#F26B2E', rani: '#C2185B', chiku: '#B88A5A', golden: '#C9A03A', mehndi: '#6E7B2C', coffee: '#6B4A2F', wine: '#7B2242', green: '#2E7D4F', teal: '#1C7A80', sand: '#BFA77A' };

// [name, TP, image, colours, godown]  (godown: 1 or 2)
const D = [
  { code: 'Y01', name: 'Rama', layout: '2-side daman', m: [['Firozi', 27, 'y01_firozi', [C.firozi], 1], ['Pink', 8, 'y01_pink', [C.pink], 1], ['Mango', 3, 'y01_mango', [C.mango], 1]] },
  { code: 'Y02', name: 'Pink old', layout: '2-side daman', m: [['Pink', 72, 'y02_pink', [C.pink], 1], ['Firozi', 34, null, [C.firozi], 1], ['Mango', 30, null, [C.mango], 2]] },
  { code: 'Y03', name: 'Pink-2 new', layout: '2-side daman', made: ['made_ceiling'], m: [
    ['Firozi', 91, 'y03_firozi', [C.firozi], 1], ['Mango', 29, 'y03_mango', [C.mango], 1], ['Mango mehndi shaded', 21, 'y03_mangomehndi', [C.mango, C.mehndi], 1],
    ['Pink shaded', 18, 'y03_pinksheded', [C.pink, C.rani], 1], ['Pink mehndi shaded', 15, 'y03_pinkmehndi', [C.pink, C.mehndi], 2], ['Pink mango shaded', 11, 'y03_pinkmango', [C.pink, C.mango], 2],
    ['Fanta', 10, 'y03_fanta', [C.fanta], 1], ['Lemon', 6, 'y03_lemon', [C.lemon], 1], ['Firozi coffee shaded', 0, 'y03_firozicoffee', [C.firozi, C.coffee], 1]] },
  { code: 'Y06B', name: 'Radhe', layout: '2-side daman', m: [['Single', 84, 'y06b', [C.golden], 1]] },
  { code: 'Y07', name: '5 mm chain', layout: 'Allover', m: [['Mango', 20, null, [C.mango], 1], ['Rani', 18, 'y07_rani', [C.rani], 1], ['Golden', 5, null, [C.golden], 1]] },
  { code: 'Y09', name: '5+3 mm cording', layout: 'Allover', m: [['Single', 52, 'y09', [C.golden], 1]] },
  { code: 'Y13', name: 'Padmavati', layout: 'Allover', m: [['Single', 25, 'y13', [C.sand], 1]] },
  { code: 'Y20', name: 'Mor', layout: '1-side daman', m: [['Mehndi shaded fanta', 1, 'y20_fenta', [C.mehndi, C.fanta], 1], ['Mehndi shaded mango', 0, null, [C.mehndi, C.mango], 1]] },
  { code: 'Y29', name: 'Half sun chroset', layout: '2-side daman', m: [['Firozi shaded', 6, 'y29_firozi', [C.firozi, C.teal], 1], ['Mango', 5, null, [C.mango], 1], ['Chiku shaded', 5, null, [C.chiku, C.coffee], 1]] },
  { code: 'Y36', name: 'Sunflower', layout: '2-side daman', m: [['Firozi', 24, 'y36_firozi', [C.firozi], 1], ['Pink', 16, null, [C.pink], 1]] },
  { code: 'Y37', name: 'B-green', layout: '2-side daman', m: [['Single', 58, 'y37', [C.green], 1]] },
  { code: 'Y38', name: 'Wine', layout: '2-side daman', m: [['Single', 79, 'y38', [C.wine], 1]] },
  { code: 'Y160', name: '', layout: 'Daman', isNew: true, m: [['Green', 11, 'y160_green', [C.green], 2], ['Pink', 0, 'y160_pink', [C.pink], 2]] },
  { code: 'Y162', name: '', layout: 'Daman', isNew: true, m: [['Firozi', 9, 'y162_firozi', [C.firozi], 2], ['Pink', 6, null, [C.pink], 2]] },
  { code: 'Y169', name: '', layout: 'Daman', isNew: true, m: [['Teal', 3, 'y169_teal', [C.teal], 2], ['Pink', 1, null, [C.pink], 2]] },
  { code: 'Y171', name: '', layout: 'Daman, patta, butta', isNew: true, made: ['made_parda'], m: [
    ['Golden daman', 4, 'y171_golden', [C.golden], 2], ['Golden patta', 5, 'y171_golden', [C.golden], 2], ['Golden butta', 3, 'y171_golden', [C.golden], 2],
    ['Teal daman', 2, 'y171_teal', [C.teal], 2], ['Teal patta', 7, 'y171_teal', [C.teal], 2]] }
];

function seed() {
  const now = new Date().toISOString();
  const godowns = [{ id: 1, name: 'Godown 1' }, { id: 2, name: 'Godown 2' }];
  const designs = [], matchings = [], stock = [], moves = [];
  let mid = 1;
  D.forEach((d, i) => {
    designs.push({ id: i + 1, code: d.code, name: d.name, layout: d.layout, isNew: !!d.isNew, made: (d.made || []).map(x => `/img/${x}.jpg`), createdAt: now });
    d.m.forEach(m => {
      const id = mid++;
      matchings.push({ id, designId: i + 1, name: m[0], colours: m[3], img: m[2] ? `/img/${m[2]}.jpg` : null });
      godowns.forEach(g => stock.push({ matchingId: id, godownId: g.id, tp: g.id === m[4] ? m[1] : 0 }));
      if (m[1] > 0) moves.push({ id: moves.length + 1, matchingId: id, godownId: m[4], tp: m[1], reason: 'opening', by: 'seed', at: now });
    });
  });
  const traders = [
    { id: 1, firm: 'Ambica Decorators', city: 'Rajkot', mobile: '9876500001', gstin: '24AAAAA0000A1Z5', active: true },
    { id: 2, firm: 'Mahalaxmi Tent House', city: 'Ahmedabad', mobile: '9876500002', gstin: '24BBBBB0000B1Z5', active: true }
  ];
  const addresses = [
    { id: 1, traderId: 1, label: 'Shop', text: 'Ambica Decorators, Dhebar Road, Rajkot 360001', contact: '9876500001' },
    { id: 2, traderId: 1, label: 'Godown', text: 'Plot 14, Aji GIDC, Rajkot 360003', contact: '9876500011' },
    { id: 3, traderId: 2, label: 'Shop', text: 'Mahalaxmi Tent House, Naroda, Ahmedabad 382330', contact: '9876500002' }
  ];
  const users = [
    { id: 'owner', password: 'Owner@123', name: 'Chirag', role: 'owner' },
    { id: 'office', password: 'Office@123', name: 'Office', role: 'office' },
    { id: 'gd', password: 'GD@123', name: 'Godown', role: 'godown' },
    { id: 'ambica', password: 'Ambica@123', name: 'Ambica Decorators', role: 'trader', traderId: 1 },
    { id: 'maha', password: 'Maha@123', name: 'Mahalaxmi Tent House', role: 'trader', traderId: 2 }
  ];
  return {
    version: 1, seq: 0, nextIds: { design: designs.length + 1, matching: mid, order: 1, trader: 3, address: 4, move: moves.length + 1, challan: 1 },
    settings: { officeWhatsApp: '919876543210', businessName: 'Yug Creation' },
    godowns, designs, matchings, stock, moves, traders, addresses, users, orders: []
  };
}

module.exports = { seed };
