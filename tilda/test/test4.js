/* Кофе, чай и напитки — нейтральная категория: сочетаются с любым заказом. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync(__dirname + '/../footer-roomservice-cart.html', 'utf8');
const CART = fs.readFileSync(__dirname + '/cart.html', 'utf8');
function msk(y,m,d,h,mi,s=0){ return Date.UTC(y,m-1,d,h-3,mi,s); }
function make(nowTs, products) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script>window.__NOW=${nowTs};Date.now=function(){return window.__NOW;};<\/script>${CART}
  <script>window.tcart={products:${JSON.stringify(products)}};
  window.__recalc=function(){var n=0;window.tcart.products.forEach(function(p){if(p){n+=(parseFloat(p.price)||0)*(p.quantity||1);}});
    window.tcart.prodamount=n;var a=n;if(window.tcart.delivery&&window.tcart.delivery.price>0){a+=+window.tcart.delivery.price;}window.tcart.amount=a;};
  window.tcart__updateTotalProductsinCartObj=function(){window.__recalc();};
  window.tcart__reDrawTotal=function(){var e=document.querySelector('.t706__cartwin-prodamount');if(e){e.textContent=String(window.tcart.prodamount);}
    var t=document.querySelector('.t706__cartwin-totalamount');if(t){t.textContent=String(window.tcart.amount);}};
  window.__sync=function(){window.__recalc();var c=document.querySelector('.js-carticon-counter');
    if(c){c.textContent=window.tcart.products.length?String(window.tcart.products.length):'';}};window.__sync();
  window.tcart__addProduct=function(p){window.tcart.products.push(p);window.__sync();return true;};
  window.tcart__deleteProduct=function(i){window.tcart.products.splice(i,1);window.__sync();};
  window.tcart__saveLocalObj=function(){};<\/script>${SRC}</body></html>`,
  { runScripts:'dangerously', pretendToBeVisual:true, url:'https://roomservice-bereza.ru/' });
  dom.window.fetch = undefined;
  return dom;
}
const P = (name, slug) => ({ name, quantity:1, price:'200', uid:slug,
  url:'https://roomservice-bereza.ru/tproduct/9000000000-' + slug });
const BREAKFAST = { name:'Шакшука', quantity:1, price:'320', uid:'523668981613',
                    url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka' };
const SET_TEA   = { name:'Сытный сет «Русский завтрак» - Чай черный крупнолистовой', quantity:1, price:'880',
                    uid:'962673916713', url:'https://roomservice-bereza.ru/tproduct/142718970583-sitnii-set-russkii-zavtrak?editionuid=962673916713' };
const BORSCH    = P('Борщ с говядиной', 'borsch');
const wait = ms => new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  ✓ '+m)):(fail++,console.log('  ✗ '+m)); };
const times = d => [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')]
  .map(b => b.getAttribute('data-time') + (b.disabled ? '✗' : '✓'));
const kind = (d, p) => d.window.RSB ? null : null;

(async () => {
  let d;

  console.log('\n28) Напитки добавляются к завтраку и к основному меню');
  const DRINKS = [
    P('Капучино', 'kapuchino'), P('Эспрессо двойной', 'espresso'), P('Латте на кокосовом молоке', 'latte'),
    P('Чай черный крупнолистовой', 'chai-chernii'), P('Чай зелёный Молочный улун', 'chai-ulun'),
    P('Какао с маршмеллоу', 'kakao'), P('Морс ягодный, 0,5 л', 'mors'), P('Сок апельсиновый', 'sok'),
    P('Лимонад домашний', 'limonad'), P('Вода без газа 0,5', 'voda')
  ];
  d = make(msk(2026,8,28,9,0), [BREAKFAST]); await wait(400);
  let bad = DRINKS.filter(x => d.window.tcart__addProduct(x) === false);
  ok(bad.length === 0, bad.length ? ('заблокированы: '+bad.map(x=>x.name).join(', ')) : 'все 10 напитков добавились к завтраку');
  ok(d.window.tcart.products.length === 11, 'в корзине 11 позиций — завтрак и 10 напитков');
  await wait(300);
  ok(d.window.document.querySelector('.rsb-err').className.indexOf('rsb-on') === -1, 'ошибки о смешивании нет');
  ok(times(d).length === 5, 'время подачи — по правилам завтрака (5 слотов)');

  d = make(msk(2026,8,28,14,0), [BORSCH]); await wait(400);
  bad = DRINKS.filter(x => d.window.tcart__addProduct(x) === false);
  ok(bad.length === 0, 'все 10 напитков добавились к основному меню');
  ok(times(d).length === 19, 'время подачи — по правилам основного меню (19 слотов через полчаса)');

  console.log('\n29) Два кофе в одном заказе');
  d = make(msk(2026,8,28,9,0), [BREAKFAST]); await wait(400);
  d.window.tcart__addProduct(P('Капучино','kapuchino'));
  d.window.tcart__addProduct(P('Капучино','kapuchino'));
  d.window.tcart__addProduct(P('Чай черный крупнолистовой','chai'));
  d.window.tcart__addProduct(P('Чай черный крупнолистовой','chai'));
  await wait(400);
  ok(d.window.tcart.products.length === 5, '2 кофе и 2 чая добавлены к завтраку');
  ok(d.window.RSB.state().разбор.menu === 'breakfast', 'заказ остался завтраком');

  console.log('\n30) Напиток внутри сета остаётся завтраком');
  d = make(msk(2026,8,28,9,0), [BORSCH]); await wait(400);
  ok(d.window.tcart__addProduct(SET_TEA) === false, '«Русский завтрак - Чай черный» не путается с напитком');

  console.log('\n31) Границы слов: десерты не превращаются в напитки');
  d = make(msk(2026,8,28,9,0), [BREAKFAST]); await wait(400);
  const NOT_DRINKS = [P('Кофейный чизкейк','kofeinii-chizkeik'), P('Тирамису с кофейным кремом','tiramisu'),
                      P('Чайная колбаса','chainaya-kolbasa'), P('Соковыжатый салат','salat')];
  const missed = NOT_DRINKS.filter(x => d.window.tcart__addProduct(x) !== false);
  ok(missed.length === 0, missed.length ? ('приняты за напиток: '+missed.map(x=>x.name).join(', ')) : 'все 4 блюда остались основным меню');

  console.log('\n32) Заказ из одних напитков — оба рабочих окна');
  d = make(msk(2026,8,28,9,0), [P('Капучино','kapuchino'), P('Капучино','kapuchino')]); await wait(400);
  ok(d.window.RSB.state().разбор.menu === 'anytime', 'режим «в любое время»');
  ok(times(d).length === 24, 'слотов 24 (оба окна): ' + times(d).slice(0,7).join(' ') + ' …');
  ok(/8:00 до 10:00 и с 13:00 до 22:00/.test(d.window.document.querySelector('.rsb-note').textContent),
     'подсказка: ' + d.window.document.querySelector('.rsb-note').textContent);

  console.log('\n33) Только кофе в 12:31 — 13:00 закрыт, 14:00 открыт');
  d = make(msk(2026,8,28,12,31), [P('Латте','latte')]); await wait(400);
  let t = times(d);
  ok(t[5] === '13:00✗' && t[6] === '13:30✓', 'слоты: ' + t.slice(5,8).join(' '));

  console.log('\n34) Только кофе в 09:45 — утро закрыто, день доступен сегодня');
  d = make(msk(2026,8,28,9,45), [P('Американо','americano')]); await wait(400);
  t = times(d);
  ok(t.slice(0,5).every(x => /✗/.test(x)), 'утренние слоты закрыты: ' + t.slice(0,5).join(' '));
  ok(t[5] === '13:00✓', 'дневные доступны на сегодня');
  ok(d.window.document.querySelectorAll('.rsb-days .rsb-chip')[0].disabled === false, '«Сегодня» доступно');

  console.log('\n35) В интерфейсе гостя нет времени на приготовление');
  d = make(msk(2026,8,28,7,31), [BREAKFAST]); await wait(400);
  const chips = [...d.window.document.querySelectorAll('.rsb-chip')].map(b => b.title).join(' ');
  let txt = d.window.document.querySelector('.rsb-slots').textContent + ' ' + chips;
  d.window.document.querySelector('.t-submit').click(); await wait(100);
  txt += ' ' + [...d.window.document.querySelectorAll('.rsb-toast')].map(x=>x.textContent).join(' ');
  [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')].find(b=>!b.disabled).click();
  await wait(300);
  txt += ' ' + d.window.document.querySelector('.rsb-status').textContent;
  ok(!/кухн|приготовлен|30 мин|60 мин|1 час/i.test(txt), 'ни «кухни», ни минут на готовку в текстах');
  ok(/Ростов-на-Дону/.test(d.window.document.querySelector('.rsb-clock').textContent), 'часы подписаны «Ростов-на-Дону»');

  console.log('\n' + (fail?'✗ ПРОВАЛЕНО: '+fail:'✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ') + '  (успешно: '+pass+')');
  process.exit(fail?1:0);
})();
