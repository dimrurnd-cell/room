/* Обслуживание 10%, слоты через полчаса и блюда, которые подаются в оба окна. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync(__dirname + '/../footer-roomservice-cart.html', 'utf8');
const CART = fs.readFileSync(__dirname + '/cart.html', 'utf8');
function msk(y,m,d,h,mi,s=0){ return Date.UTC(y,m-1,d,h-3,mi,s); }
function make(nowTs, products, pre) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script>window.__NOW=${nowTs};Date.now=function(){return window.__NOW;};<\/script>${CART}
  <script>window.tcart={products:${JSON.stringify(products)}};
  ${pre || ''}
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
const P = (name, price, slug) => ({ name, price:String(price), quantity:1, uid:slug,
  url:'https://roomservice-bereza.ru/tproduct/9000000000-' + slug });
const SYRNIKI  = { name:'Воздушные домашние сырники с топпингом на выбор - Ягодный джем', price:'220', quantity:1,
  uid:'821698252483', url:'https://roomservice-bereza.ru/tproduct/315374361683-vozdushnie-domashnie-sirniki-s-toppingom?editionuid=821698252483' };
const ZAPEKANKA= { name:'Нежная творожная запеканка с топпингом на выбор - Ягодный джем', price:'390', quantity:1,
  uid:'829041918013', url:'https://roomservice-bereza.ru/tproduct/378144183863-nezhnaya-tvorozhnaya-zapekanka-s-topping?editionuid=829041918013' };
const SHAKSHUKA= { name:'Шакшука', price:'320', quantity:1, uid:'523668981613',
  url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka' };
const BORSCH   = P('Борщ с говядиной', 450, 'borsch');
const wait = ms => new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  ✓ '+m)):(fail++,console.log('  ✗ '+m)); };
const times = d => [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')]
  .map(b => b.getAttribute('data-time') + (b.disabled ? '✗' : '✓'));

(async () => {
  let d;

  console.log('\n36) Обслуживание 10% добавляется к сумме заказа');
  d = make(msk(2026,8,28,9,0), [P('Заказ', 10000, 'zakaz')]); await wait(500);
  let t = d.window.tcart;
  ok(!!t.delivery && t.delivery.name === 'Обслуживание 10%', 'строка называется «Обслуживание 10%»');
  ok(t.delivery.price === 1000, 'обслуживание с 10 000 = ' + t.delivery.price);
  ok(t.amount === 11000, 'итоговая сумма ' + t.amount);
  ok(d.window.document.querySelector('.t706__cartwin-totalamount').textContent === '11000',
     'итог отрисован в корзине: ' + d.window.document.querySelector('.t706__cartwin-totalamount').textContent);

  console.log('\n37) Пересчёт при изменении корзины');
  d.window.tcart__addProduct(P('Ещё блюдо', 500, 'esche'));
  await wait(900);
  ok(d.window.tcart.delivery.price === 1050, 'после добавления 500 руб. обслуживание = ' + d.window.tcart.delivery.price);
  ok(d.window.tcart.amount === 11550, 'итог = ' + d.window.tcart.amount);
  d.window.tcart__deleteProduct(1); await wait(900);
  ok(d.window.tcart.delivery.price === 1000, 'после удаления вернулось к ' + d.window.tcart.delivery.price);

  console.log('\n38) Пустая корзина — обслуживания нет');
  d.window.tcart__deleteProduct(0); await wait(900);
  ok(!d.window.tcart.delivery, 'строка обслуживания убрана');
  ok(d.window.tcart.amount === 0, 'итог 0');

  console.log('\n39) Округление до рубля');
  d = make(msk(2026,8,28,9,0), [P('Блюдо', 325, 'x')]); await wait(500);
  ok(d.window.tcart.delivery.price === 33, '10% от 325 = 32,5 → ' + d.window.tcart.delivery.price);
  ok(d.window.tcart.amount === 358, 'итог ' + d.window.tcart.amount);

  console.log('\n40) Чужая доставка не перезаписывается');
  d = make(msk(2026,8,28,9,0), [P('Блюдо', 1000, 'y')],
           "window.tcart.delivery={name:'Курьером по городу',price:300};"); await wait(600);
  ok(d.window.tcart.delivery.name === 'Курьером по городу', 'доставка сайта осталась: ' + d.window.tcart.delivery.name);
  ok(d.window.tcart.delivery.price === 300, 'её цена не тронута');

  console.log('\n41) Сырники и запеканка подаются в оба окна');
  d = make(msk(2026,8,28,9,0), [SYRNIKI, ZAPEKANKA]); await wait(500);
  ok(d.window.RSB.state().разбор.menu === 'anytime', 'режим «в любое время»');
  ok(times(d).length === 24, 'доступны оба окна, слотов ' + times(d).length);
  ok(d.window.document.querySelector('.rsb-err').className.indexOf('rsb-on') === -1, 'конфликта нет');
  ok(/8:00 до 10:00 и с 13:00 до 22:00/.test(d.window.document.querySelector('.rsb-note').textContent),
     'подсказка: ' + d.window.document.querySelector('.rsb-note').textContent);

  console.log('\n42) Сырники в компании других блюд');
  d = make(msk(2026,8,28,9,0), [SHAKSHUKA]); await wait(400);
  ok(d.window.tcart__addProduct(SYRNIKI) === true, 'к завтраку добавляются');
  await wait(700);
  ok(d.window.RSB.state().разбор.menu === 'breakfast' && times(d).length === 5, 'заказ остался завтраком, 5 слотов');

  d = make(msk(2026,8,28,14,0), [BORSCH]); await wait(400);
  ok(d.window.tcart__addProduct(ZAPEKANKA) === true, 'к основному меню добавляются');
  await wait(700);
  ok(d.window.RSB.state().разбор.menu === 'main' && times(d).length === 19, 'заказ остался основным меню, 19 слотов');

  console.log('\n43) Слоты через полчаса');
  d = make(msk(2026,8,28,11,0), [BORSCH]); await wait(500);
  t = times(d).map(x => x.slice(0,5));
  ok(t.slice(0,4).join(' ') === '13:00 13:30 14:00 14:30', 'основное меню: ' + t.slice(0,4).join(' '));
  ok(t[t.length-1] === '22:00' && t.length === 19, 'последний слот 22:00, всего ' + t.length);
  d = make(msk(2026,8,28,6,0), [SHAKSHUKA]); await wait(500);
  t = times(d).map(x => x.slice(0,5));
  ok(t.join(' ') === '08:00 08:30 09:00 09:30 10:00', 'завтраки: ' + t.join(' '));

  console.log('\n44) Утро и день разделены подписями');
  d = make(msk(2026,8,28,6,0), [SYRNIKI]); await wait(500);
  const labels = [...d.window.document.querySelectorAll('.rsb-glabel')].map(x => x.textContent);
  ok(labels.join(' / ') === 'Утро / День', 'подписи групп: ' + labels.join(' / '));
  d = make(msk(2026,8,28,11,0), [BORSCH]); await wait(500);
  ok(d.window.document.querySelectorAll('.rsb-glabel').length === 0, 'в одном окне подписи не нужны');

  console.log('\n45) Обслуживание и выбор времени вместе');
  d = make(msk(2026,8,28,7,0), [SHAKSHUKA]); await wait(500);
  [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')].find(b => !b.disabled).click();
  await wait(300);
  ok(d.window.document.querySelector('input[name="vremya_dostavki"]').value === '08:00', 'время выбрано');
  ok(d.window.tcart.delivery.price === 32 && d.window.tcart.amount === 352,
     'обслуживание с 320 руб. = ' + d.window.tcart.delivery.price + ', итог ' + d.window.tcart.amount);

  console.log('\n' + (fail?'✗ ПРОВАЛЕНО: '+fail:'✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ') + '  (успешно: '+pass+')');
  process.exit(fail?1:0);
})();
