/* Регрессия по сообщению с сайта: при пустой корзине завтрак не добавлялся — «Завтрак нельзя
   добавить к этому заказу». Проверяем все состояния, при которых корзина выглядит пустой. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync(__dirname + '/../footer-roomservice-cart.html', 'utf8');
const CART = fs.readFileSync(__dirname + '/cart.html', 'utf8');
function msk(y,m,d,h,mi,s=0){ return Date.UTC(y,m-1,d,h-3,mi,s); }

function make(nowTs, products, opts) {
  opts = opts || {};
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script>window.__NOW=${nowTs};Date.now=function(){return window.__NOW;};<\/script>${CART}
  <script>
    ${opts.stale ? `try{localStorage.setItem('tcart',JSON.stringify({products:${JSON.stringify(opts.stale)}}));}catch(e){}` : ''}
    window.tcart = { products: ${JSON.stringify(products)} };
    window.__recalc = function () {
      var n = 0;
      window.tcart.products.forEach(function (p) { if (p) { n += (parseFloat(p.price) || 0) * (p.quantity || 1); } });
      window.tcart.prodamount = n;
      var a = n;
      if (window.tcart.delivery && window.tcart.delivery.price > 0) { a += +window.tcart.delivery.price; }
      window.tcart.amount = a;
    };
    window.tcart__updateTotalProductsinCartObj = function () { window.__recalc(); };
    window.tcart__reDrawTotal = function () {
      var e = document.querySelector('.t706__cartwin-prodamount');
      if (e) { e.textContent = String(window.tcart.prodamount); }
      var t = document.querySelector('.t706__cartwin-totalamount');
      if (t) { t.textContent = String(window.tcart.amount); }
    };
    window.__sync = function () { window.__recalc(); var c = document.querySelector('.js-carticon-counter');
      if (c) { c.textContent = ${opts.counter !== undefined ? JSON.stringify(String(opts.counter)) : 'window.tcart.products.length ? String(window.tcart.products.length) : ""'}; } };
    window.__sync();
    window.tcart__addProduct = function (p) { window.tcart.products.push(p); window.__sync(); return true; };
    window.tcart__deleteProduct = function (i) { window.tcart.products.splice(i, 1); window.__sync(); };
    window.tcart__saveLocalObj = function () {};
  <\/script>${SRC}</body></html>`,
  { runScripts:'dangerously', pretendToBeVisual:true, url:'https://roomservice-bereza.ru/' });
  dom.window.fetch = undefined;
  return dom;
}
const BREAKFAST = { name:'Шакшука', price:'320', quantity:1, uid:'523668981613',
                    url:'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka' };
const MAIN = { name:'Борщ с говядиной', price:'450', quantity:1, uid:'900000000001',
               url:'https://roomservice-bereza.ru/tproduct/900000000001-borsch' };
const wait = ms => new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  ✓ '+m)):(fail++,console.log('  ✗ '+m)); };
const toasts = d => [...d.window.document.querySelectorAll('.rsb-toast__t')].map(x=>x.textContent);

(async () => {
  let d;

  console.log('\n21) Пустая корзина — завтрак добавляется без ошибки');
  d = make(msk(2026,8,28,9,0), []); await wait(400);
  ok(d.window.tcart__addProduct(BREAKFAST) === true, 'товар добавлен');
  ok(toasts(d).length === 0, 'ошибок не показано');

  console.log('\n22) «Фантом» с нулевым количеством — корзина считается пустой');
  d = make(msk(2026,8,28,9,0), [Object.assign({}, MAIN, { quantity: 0 })]); await wait(400);
  ok(d.window.RSB.state().учтеноПозиций === 0, 'позиция с quantity=0 не учитывается');
  ok(d.window.document.querySelector('.rsb-slots').className.indexOf('rsb-on') === -1, 'панель скрыта');
  ok(d.window.tcart__addProduct(BREAKFAST) === true, 'завтрак добавляется');
  ok(toasts(d).length === 0, 'ошибок не показано');

  console.log('\n23) Пустые записи в tcart.products (null / {}) — не блокируют');
  d = make(msk(2026,8,28,9,0), [null, {}, { name:'', quantity:1 }]); await wait(400);
  ok(d.window.RSB.state().учтеноПозиций === 0, 'мусорные записи отброшены');
  ok(d.window.tcart__addProduct(BREAKFAST) === true, 'завтрак добавляется');

  console.log('\n24) Объект Tilda устарел, а счётчик корзины показывает пусто — не блокируем');
  d = make(msk(2026,8,28,9,0), [MAIN], { counter: '' }); await wait(400);
  ok(d.window.tcart__addProduct(BREAKFAST) === true, 'добавление разрешено (доверяем счётчику Tilda)');
  ok(toasts(d).length === 0, 'гость не упирается в ошибку');

  console.log('\n25) Настоящий конфликт: блокировка + выход одной кнопкой');
  d = make(msk(2026,8,28,9,0), [MAIN]); await wait(400);
  ok(d.window.tcart__addProduct(BREAKFAST) === false, 'завтрак не добавлен к основному меню');
  await wait(60);
  ok(/Завтрак нельзя добавить/.test(toasts(d)[0] || ''), 'показана ошибка: ' + toasts(d)[0]);
  const btn = d.window.document.querySelector('.rsb-toast__b');
  ok(!!btn && btn.textContent === 'Очистить корзину и добавить', 'в уведомлении есть кнопка выхода');
  btn.click(); await wait(700);
  ok(d.window.tcart.products.length === 1 && d.window.tcart.products[0].name === 'Шакшука',
     'корзина очищена, завтрак добавлен');
  await wait(400);
  ok(d.window.document.querySelector('.rsb-err').className.indexOf('rsb-on') === -1, 'конфликта больше нет');
  ok(d.window.document.querySelector('.rsb-slots').className.indexOf('rsb-on') !== -1, 'панель времени показана');

  console.log('\n26) Устаревшая копия в localStorage не воскрешает пустую корзину');
  d = make(msk(2026,8,28,9,0), [], { stale: [MAIN] }); await wait(400);
  ok(d.window.RSB.state().учтеноПозиций === 0, 'живой объект Tilda важнее хранилища');
  ok(d.window.tcart__addProduct(BREAKFAST) === true, 'завтрак добавляется');

  console.log('\n27) Диагностика для поддержки');
  d = make(msk(2026,8,28,7,31), [BREAKFAST]); await wait(400);
  const st = d.window.RSB.state();
  ok(st.времяМСК === '07:31' && st.учтеноПозиций === 1 && st.разбор.menu === 'breakfast',
     'RSB.state(): ' + JSON.stringify({ t: st.времяМСК, n: st.учтеноПозиций, m: st.разбор.menu, c: st.счётчикTilda }));

  console.log('\n' + (fail?'✗ ПРОВАЛЕНО: '+fail:'✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ') + '  (успешно: '+pass+')');
  process.exit(fail?1:0);
})();
