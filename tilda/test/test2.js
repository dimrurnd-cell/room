const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync(__dirname + '/../footer-roomservice-cart.html', 'utf8');
const ALL = JSON.parse(fs.readFileSync(__dirname + '/breakfast.json', 'utf8'));
function msk(y,m,d,h,mi,s=0){ return Date.UTC(y,m-1,d,h-3,mi,s); }
const CART = fs.readFileSync(__dirname + '/cart.html','utf8');
function make(nowTs, products) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script>window.__NOW=${nowTs};Date.now=function(){return window.__NOW;};<\/script>${CART}
  <script>window.tcart={products:${JSON.stringify(products)}};
  window.__recalc=function(){var n=0;window.tcart.products.forEach(function(p){if(p){n+=(parseFloat(p.price)||0)*(p.quantity||1);}});
    window.tcart.prodamount=n;var a=n;if(window.tcart.delivery&&window.tcart.delivery.price>0){a+=+window.tcart.delivery.price;}window.tcart.amount=a;};
  window.tcart__updateTotalProductsinCartObj=function(){window.__recalc();};
  window.tcart__reDrawTotal=function(){var e=document.querySelector('.t706__cartwin-prodamount');if(e){e.textContent=String(window.tcart.prodamount);}
    var t=document.querySelector('.t706__cartwin-totalamount');if(t){t.textContent=String(window.tcart.amount);}};
  window.__sync=function(){window.__recalc();var c=document.querySelector('.js-carticon-counter');if(c){c.textContent=window.tcart.products.length?String(window.tcart.products.length):'';}};window.__sync();
  window.tcart__addProduct=function(p){window.tcart.products.push(p);window.__sync();return true;};
  window.tcart__deleteProduct=function(i){window.tcart.products.splice(i,1);window.__sync();};
  window.tcart__saveLocalObj=function(){};<\/script>${SRC}</body></html>`,
  { runScripts:'dangerously', pretendToBeVisual:true, url:'https://roomservice-bereza.ru/' });
  dom.window.fetch = undefined;
  return dom;
}
const wait = ms => new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  ✓ '+m)):(fail++,console.log('  ✗ '+m)); };

(async () => {
  console.log('\n16) Позиции из выгрузки: завтраки блокируются, сырники и запеканка — нет');
  const main = { name:'Борщ с говядиной', url:'https://roomservice-bereza.ru/tproduct/111111111111-borsch', uid:'1' };
  let d = make(msk(2026,8,28,9,0), [main]); await wait(400);
  const ANY = /запеканк|сырник/i;                     // подаются и утром, и днём
  let bad = [], anyOk = [];
  ALL.forEach(p => {
    const blocked = d.window.tcart__addProduct(p) === false;
    if (!blocked) d.window.tcart.products.pop();
    if (ANY.test(p.name)) { if (!blocked) anyOk.push(p.name); }
    else if (!blocked) bad.push(p.name);
  });
  ok(bad.length === 0, bad.length ? ('НЕ опознаны как завтрак: ' + bad.join(' | '))
     : `все ${ALL.length - anyOk.length} завтраков заблокированы к добавлению в заказ основного меню`);
  ok(anyOk.length === 8, `сырники и запеканка (${anyOk.length} позиции) свободно добавляются к основному меню`);

  console.log('\n17) Блюда основного меню НЕ считаются завтраками');
  d = make(msk(2026,8,28,9,0), [main]); await wait(400);
  const mains = [
    {name:'Борщ с говядиной и сметаной', url:'https://roomservice-bereza.ru/tproduct/900000000001-borsch'},
    {name:'Цезарь с курицей', url:'https://roomservice-bereza.ru/tproduct/900000000002-cezar-s-kuritsei'},
    {name:'Стейк из лосося', url:'https://roomservice-bereza.ru/tproduct/900000000003-steik-iz-lososya'},
    {name:'Паста Карбонара', url:'https://roomservice-bereza.ru/tproduct/900000000004-pasta-karbonara'},
    {name:'Пельмени домашние', url:'https://roomservice-bereza.ru/tproduct/900000000005-pelmeni'},
    {name:'Чизкейк Нью-Йорк', url:'https://roomservice-bereza.ru/tproduct/900000000006-chizkeik'}
  ];
  let wrong = [];
  mains.forEach(p => { if (d.window.tcart__addProduct(p) === false) { wrong.push(p.name); } else { d.window.tcart.products.pop(); } });
  ok(wrong.length === 0, wrong.length ? ('ошибочно приняты за завтрак: '+wrong.join(' | ')) : 'все 6 блюд основного меню свободно добавляются в заказ основного меню');
  // и обратная проверка: в корзине завтрак -> те же блюда блокируются
  d = make(msk(2026,8,28,9,0), [{name:'Шакшука',url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka',uid:'1'}]); await wait(400);
  const notBlocked = mains.filter(p => d.window.tcart__addProduct(p) !== false);
  ok(notBlocked.length === 0, 'те же блюда не добавляются в заказ с завтраком');

  console.log('\n18) Ночь: 02:00 МСК — завтрак можно заказать на сегодня с 08:00');
  d = make(msk(2026,8,28,2,0), [{name:'Шакшука',url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka',uid:'1'}]); await wait(400);
  const t = [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')];
  ok(t.every(x=>!x.disabled), 'все 5 слотов доступны');
  ok(d.window.document.querySelectorAll('.rsb-days .rsb-chip')[0].className.indexOf('rsb-sel')!==-1, 'выбрано «Сегодня»');

  console.log('\n19) 23:50 МСК — основное меню только на завтра, дата = следующий день');
  d = make(msk(2026,8,28,23,50), [{name:'Борщ',url:'https://roomservice-bereza.ru/tproduct/900000000001-borsch',uid:'1'}]); await wait(400);
  const days = [...d.window.document.querySelectorAll('.rsb-days .rsb-chip')];
  ok(days[0].disabled && days[1].className.indexOf('rsb-sel')!==-1, '«Сегодня» закрыто, выбрано «Завтра»');
  d.window.document.querySelector('.rsb-times .rsb-chip').click(); await wait(50);
  ok(d.window.document.querySelector('input[name="data_dostavki"]').value === '29-08-2026',
     'дата в поле Tilda: ' + d.window.document.querySelector('input[name="data_dostavki"]').value);

  console.log('\n20) Гость в часовом поясе UTC+12 (телефон показывает другое число)');
  d = make(msk(2026,8,28,7,31), [{name:'Шакшука',url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka',uid:'1'}]); await wait(400);
  ok([...d.window.document.querySelectorAll('.rsb-times .rsb-chip')][0].disabled === true, 'логика МСК не зависит от часового пояса устройства');
  ok(/Ростов-на-Дону/.test(d.window.document.querySelector('.rsb-clock').textContent) &&
     /07:31/.test(d.window.document.querySelector('.rsb-clock b').textContent), 'часы: Ростов-на-Дону, 07:31');

  console.log('\n' + (fail?'✗ ПРОВАЛЕНО: '+fail:'✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ') + '  (успешно: '+pass+')');
  process.exit(fail?1:0);
})();
