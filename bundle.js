var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(c,e,a){c!=Array.prototype&&c!=Object.prototype&&(c[e]=a.value)};$jscomp.getGlobal=function(c){return"undefined"!=typeof window&&window===c?c:"undefined"!=typeof global&&null!=global?global:c};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(c,e,a,b){if(e){a=$jscomp.global;c=c.split(".");for(b=0;b<c.length-1;b++){var d=c[b];d in a||(a[d]={});a=a[d]}c=c[c.length-1];b=a[c];e=e(b);e!=b&&null!=e&&$jscomp.defineProperty(a,c,{configurable:!0,writable:!0,value:e})}};$jscomp.polyfill("Math.log1p",(function(c){return c?c:function(c){c=Number(c);if(.25>c&&-.25<c){for(var a=c,b=1,d=c,e=0,f=1;e!=d;)a*=c,f*=-1,d=(e=d)+f*a/++b;return d}return Math.log(1+c)}}),"es6-impl","es3");$jscomp.SYMBOL_PREFIX="jscomp_symbol_";
$jscomp.initSymbol=function(){$jscomp.initSymbol=function(){};$jscomp.global.Symbol||($jscomp.global.Symbol=$jscomp.Symbol)};$jscomp.symbolCounter_=0;$jscomp.Symbol=function(c){return $jscomp.SYMBOL_PREFIX+(c||"")+$jscomp.symbolCounter_++};
$jscomp.initSymbolIterator=function(){$jscomp.initSymbol();var c=$jscomp.global.Symbol.iterator;c||(c=$jscomp.global.Symbol.iterator=$jscomp.global.Symbol("iterator"));"function"!=typeof Array.prototype[c]&&$jscomp.defineProperty(Array.prototype,c,{configurable:!0,writable:!0,value:function(){return $jscomp.arrayIterator(this)}});$jscomp.initSymbolIterator=function(){}};$jscomp.arrayIterator=function(c){var e=0;return $jscomp.iteratorPrototype((function(){return e<c.length?{done:!1,value:c[e++]}:{done:!0}}))};
$jscomp.iteratorPrototype=function(c){$jscomp.initSymbolIterator();c={next:c};c[$jscomp.global.Symbol.iterator]=function(){return this};return c};$jscomp.makeIterator=function(c){$jscomp.initSymbolIterator();var e=c[Symbol.iterator];return e?e.call(c):$jscomp.arrayIterator(c)};$jscomp.FORCE_POLYFILL_PROMISE=!1;
$jscomp.polyfill("Promise",(function(c){function e(){this.batch_=null}function a(a){return a instanceof d?a:new d(function(b,f){b(a)})}if(c&&!$jscomp.FORCE_POLYFILL_PROMISE)return c;e.prototype.asyncExecute=function(a){null==this.batch_&&(this.batch_=[],this.asyncExecuteBatch_());this.batch_.push(a);return this};e.prototype.asyncExecuteBatch_=function(){var a=this;this.asyncExecuteFunction((function(){a.executeBatch_()}))};var b=$jscomp.global.setTimeout;e.prototype.asyncExecuteFunction=function(a){b(a,
0)};e.prototype.executeBatch_=function(){for(;this.batch_&&this.batch_.length;){var a=this.batch_;this.batch_=[];for(var b=0;b<a.length;++b){var d=a[b];delete a[b];try{d()}catch(k){this.asyncThrow_(k)}}}this.batch_=null};e.prototype.asyncThrow_=function(a){this.asyncExecuteFunction((function(){throw a;}))};var d=function(a){this.state_=0;this.result_=void 0;this.onSettledCallbacks_=[];var b=this.createResolveAndReject_();try{a(b.resolve,b.reject)}catch(g){b.reject(g)}};d.prototype.createResolveAndReject_=
function(){function a(a){return function(c){d||(d=!0,a.call(b,c))}}var b=this,d=!1;return{resolve:a(this.resolveTo_),reject:a(this.reject_)}};d.prototype.resolveTo_=function(a){if(a===this)this.reject_(new TypeError("A Promise cannot resolve to itself"));else if(a instanceof d)this.settleSameAsPromise_(a);else{a:switch(typeof a){case "object":var b=null!=a;break a;case "function":b=!0;break a;default:b=!1}b?this.resolveToNonPromiseObj_(a):this.fulfill_(a)}};d.prototype.resolveToNonPromiseObj_=function(a){var b=
void 0;try{b=a.then}catch(g){this.reject_(g);return}"function"==typeof b?this.settleSameAsThenable_(b,a):this.fulfill_(a)};d.prototype.reject_=function(a){this.settle_(2,a)};d.prototype.fulfill_=function(a){this.settle_(1,a)};d.prototype.settle_=function(a,b){if(0!=this.state_)throw Error("Cannot settle("+a+", "+b|"): Promise already settled in state"+this.state_);this.state_=a;this.result_=b;this.executeOnSettledCallbacks_()};d.prototype.executeOnSettledCallbacks_=function(){if(null!=this.onSettledCallbacks_){for(var a=
this.onSettledCallbacks_,b=0;b<a.length;++b)a[b].call(),a[b]=null;this.onSettledCallbacks_=null}};var h=new e;d.prototype.settleSameAsPromise_=function(a){var b=this.createResolveAndReject_();a.callWhenSettled_(b.resolve,b.reject)};d.prototype.settleSameAsThenable_=function(a,b){var d=this.createResolveAndReject_();try{a.call(b,d.resolve,d.reject)}catch(k){d.reject(k)}};d.prototype.then=function(a,b){function c(a,b){return"function"==typeof a?function(b){try{e(a(b))}catch(m){f(m)}}:b}var e,f,n=new d(function(a,
b){e=a;f=b});this.callWhenSettled_(c(a,e),c(b,f));return n};d.prototype.catch=function(a){return this.then(void 0,a)};d.prototype.callWhenSettled_=function(a,b){function d(){switch(c.state_){case 1:a(c.result_);break;case 2:b(c.result_);break;default:throw Error("Unexpected state: "+c.state_);}}var c=this;null==this.onSettledCallbacks_?h.asyncExecute(d):this.onSettledCallbacks_.push((function(){h.asyncExecute(d)}))};d.resolve=a;d.reject=function(a){return new d(function(b,d){d(a)})};d.race=function(b){return new d(function(d,
c){for(var e=$jscomp.makeIterator(b),g=e.next();!g.done;g=e.next())a(g.value).callWhenSettled_(d,c)})};d.all=function(b){var c=$jscomp.makeIterator(b),e=c.next();return e.done?a([]):new d(function(b,d){function g(a){return function(d){f[a]=d;h--;0==h&&b(f)}}var f=[],h=0;do f.push(void 0),h++,a(e.value).callWhenSettled_(g(f.length-1),d),e=c.next();while(!e.done)})};return d}),"es6-impl","es3");
(function(c){function e(b){if(a[b])return a[b].exports;var d=a[b]={i:b,l:!1,exports:{}};c[b].call(d.exports,d,d.exports,e);d.l=!0;return d.exports}var a={};e.m=c;e.c=a;e.d=function(a,d,c){e.o(a,d)||Object.defineProperty(a,d,{configurable:!1,enumerable:!0,get:c})};e.n=function(a){var b=a&&a.__esModule?function(){return a["default"]}:function(){return a};e.d(b,"a",b);return b};e.o=function(a,d){return Object.prototype.hasOwnProperty.call(a,d)};e.p="";return e(e.s=0)})([(function(c,e,a){a(1);a(2);a(3);
a(4);a(5);a(6);var b=a(7);b.install({onUpdating:function(){console.log("SW Event:","onUpdating")},onUpdateReady:function(){console.log("SW Event:","onUpdateReady");b.applyUpdate()},onUpdated:function(){console.log("SW Event:","onUpdated");window.location.reload()},onUpdateFailed:function(){console.log("SW Event:","onUpdateFailed")}})}),(function(c,e,a){c.exports=a.p+"index.html"}),(function(c,e,a){c.exports=a.p+"embedEn.html"}),(function(c,e){}),(function(c,e){}),(function(c,e){}),(function(c,e){var a={day:0,
cupCost:1,signCost:.5,allTimeProfit:20,dailyProfit:0,confidence:3,tomorrowWeatherVariant:3,tomorrowForecast:"",todayWeatherVariant:3,todayForecast:"",sold:0,emotion:document.getElementById("emotionDisplay"),forecastDisplay:document.getElementById("forecastDisplay"),bar:document.getElementById("percentageBar"),play:document.getElementById("play"),cupsVar:document.getElementById("cups"),signsVar:document.getElementById("signs"),priceVar:document.getElementById("price"),strawVar:function(){return document.getElementById("straw")},
lemonVar:function(){return document.getElementById("lemon")},glassTopVar:function(){return document.getElementById("glassTop")},glassBottomVar:function(){return document.getElementById("glassBottom")},lemonade1:document.getElementById("lemonade1"),lemonade2:document.getElementById("lemonade2"),dayDisplayVar:document.getElementById("dayDisplay"),cupsSoldDisplayVar:document.getElementById("cupsSoldDisplay"),grandTotalDisplayVar:document.getElementById("grandTotalDisplay"),weather:["mdi mdi-weather-lightning-rainy mdi-36px",
"mdi mdi-weather-cloudy mdi-36px","mdi mdi-weather-partlycloudy mdi-36px","mdi mdi-weather-sunny mdi-36px"],emotionBank:"mdi mdi-emoticon-dead mdi-36px;mdi mdi-emoticon-sad mdi-36px;mdi mdi-emoticon-neutral mdi-36px;mdi mdi-emoticon mdi-36px;mdi mdi-emoticon-excited mdi-36px;mdi mdi-emoticon-cool mdi-36px".split(";"),diagnostic:function(b){console.debug(a.signsVar.valueAsNumber+" signs market: "+a.stringRound(b)+" Cost: $"+a.stringRound(a.priceVar.valueAsNumber)+" Weather "+a.todayWeatherVariant+
" Sold "+a.sold+" cups")},whenLoaded:function(){a.pourIn();a.play.addEventListener("click",a.nextDay);a.displayUpdate();document.getElementById("loader").remove();document.getElementById("play").className+=" scale-in";window.Materialize.toast("It's a nice day to sell Lemonade!",5E3)},cheat:function(){a.cheating=!0;window.Materialize.toast("Cheat enabled",4E3);a.day=4E4;a.allTimeProfit=4E4;a.confidence=3;a.tomorrowForecast=a.cheatWeather;a.cupsVar.valueAsNumber=300;a.signsVar.valueAsNumber=0;a.priceVar.valueAsNumber=
2.5;a.cheatWeather=2;a.displayUpdate();for(var b=14;0<b;--b)a.priceVar.valueAsNumber+=.5,a.nextDay();return"You are cheating!"},marketingResult:function(){var b=Math.pow(a.signs,2)/Math.log1p(a.signs);if(isNaN(b)||1>b)b=0;a.cheating&&a.diagnostic(b);var d=a.randomNumber(1,3.5)*a.confidence;return(b+d)/a.price*(Math.pow(a.todayWeatherVariant,2)+1)},toastVar:function(){return document.getElementById("toast-container").innerHTML},randomNumber:function(a,d){return Math.floor(Math.random()*(d-a))+a},stringRound:function(a){return a.toFixed(2)},
twoDecimals:function(a){return Math.round(100*a)/100},average:function(){return(a.allTimeProfit-a.dailyProfit)/a.day},determineConfidence:function(){10>a.allTimeProfit?(a.confidence=0,a.clearToast(),window.Materialize.toast("Bankrupt! Better luck next time!",3E4),a.play.removeEventListener("click",a.nextDay),a.play.addEventListener("click",a.newGame),a.pourOut(),a.clean()):0===a.dailyProfit?a.confidence=2:a.dailyProfit<a.average()?a.confidence=1:60>a.dailyProfit-a.average()?a.confidence=Math.round((a.dailyProfit-
a.average())/20+2):a.confidence=5;return a.confidence},newGame:function(){a.play.removeEventListener("click",a.newGame);a.day=0;a.tomorrowWeatherVariant=3;a.todayWeatherVariant=3;a.sold=0;a.allTimeProfit=20;a.dailyProfit=0;a.emotion.className=a.emotionBank[3];a.emotion.className=a.emotionBank[3];a.confidence=3;a.cupsVar.valueAsNumber=150;a.signsVar.valueAsNumber=10;a.priceVar.valueAsNumber=4;a.clearToast();window.Materialize.toast("It's a nice day to sell Lemonade!",5E3);a.displayUpdate();a.pourIn();
a.play.addEventListener("click",a.nextDay)},nextDay:function(){a.cups=a.cupsVar.valueAsNumber;a.signs=a.signsVar.valueAsNumber;a.price=a.priceVar.valueAsNumber;a.todayWeatherVariant=a.tomorrowWeatherVariant;a.todayForecast=a.tomorrowForecast;a.expenses=a.twoDecimals(a.signs*a.signCost+a.cups*a.cupCost);a.expenses>a.allTimeProfit?(a.clearToast(),a.clean(),window.Materialize.toast("You can't afford $"+a.stringRound(a.expenses)+"!",2E3),window.Materialize.toast("$"+a.stringRound(a.cupCost)+" per Cup | $"+
a.stringRound(a.signCost)+" per Sign",6E3),a.cupsVar.valueAsNumber=a.allTimeProfit-2,a.signsVar.valueAsNumber=2):(a.sold=Math.round(a.marketingResult()),0<a.sold&&a.sold<a.cups?a.bar.style.width=a.sold/a.cups*100+"%":0===a.sold?a.bar.style.width=0:(a.sold=a.cups,a.bar.style.width=a.sold/a.cups*100+"%"),a.profits=a.twoDecimals(a.sold*a.price),a.dailyProfit=a.twoDecimals(a.profits-a.expenses),a.allTimeProfit+=a.dailyProfit,a.allTimeProfit=a.twoDecimals(a.allTimeProfit),window.Materialize.toast("Profit: $"+
a.stringRound(a.profits)+" | Expense: $"+a.stringRound(a.expenses),6E3),a.determineConfidence(),a.tomorrowWeatherVariant=a.randomNumber(0,4),a.cheating&&(a.tomorrowWeatherVariant=a.cheatWeather),a.day+=1,a.displayUpdate())},displayUpdate:function(){a.tomorrowForecast=a.weather[a.tomorrowWeatherVariant];a.forecastDisplay.className=a.tomorrowForecast;a.emotion.className=a.emotionBank[a.confidence];a.dayDisplayVar.innerText="Day "+a.day;a.cupsSoldDisplayVar.innerText=a.sold+" Cups | $"+a.stringRound(a.dailyProfit);
a.grandTotalDisplayVar.innerText="$"+a.stringRound(a.allTimeProfit)},clearToast:function(){a.toastVar=""},clean:function(){1<document.getElementById("range1").children.length&&document.getElementById("range1").children[1].remove();1<document.getElementById("range2").children.length&&document.getElementById("range2").children[1].remove();1<document.getElementById("range3").children.length&&document.getElementById("range3").children[1].remove()},resetAnimation:function(){a.strawVar().classList.remove("straw2");
a.lemonVar().classList.remove("lemon2");document.getElementById("lemonade1").classList.remove("liquid2");document.getElementById("lemonade2").classList.remove("liquid2");for(var b=1;6>b;b+=1)document.getElementById("cube"+b).classList.remove("cubes2");a.strawVar().classList.remove("straw");a.lemonVar().classList.remove("lemon");a.glassTopVar().classList.remove("glass");a.glassBottomVar().classList.remove("glass");document.getElementById("lemonade1").classList.remove("liquid");document.getElementById("lemonade2").classList.remove("liquid");
for(b=1;6>b;b+=1)document.getElementById("cube"+b).classList.remove("cubes")},pourIn:function(){a.resetAnimation();setTimeout((function(){a.strawVar().classList.add("straw");a.lemonVar().classList.add("lemon");document.getElementById("lemonade1").classList.add("liquid");document.getElementById("lemonade2").classList.add("liquid");for(var b=1;6>b;b+=1)document.getElementById("cube"+b).classList.add("cubes")}),5)},pourOut:function(){a.resetAnimation();setTimeout((function(){a.strawVar().classList.add("straw2");
a.lemonVar().classList.add("lemon2");a.glassTopVar().classList.add("glass2");a.glassBottomVar().classList.add("glass2");a.lemonade1.classList.add("liquid2");a.lemonade2.classList.add("liquid2");for(var b=1;6>b;b+=1)document.getElementById("cube"+b).classList.add("cubes2")}),5)}};window.lemonade=a}),(function(c,e){function a(){return"serviceWorker"in navigator&&(window.fetch||"imageRendering"in document.documentElement.style)&&("https:"===window.location.protocol||"localhost"===window.location.hostname||
0===window.location.hostname.indexOf("127."))}var b;e.install=function(d){d||(d={});if(a()){var c=function(a){function b(){switch(d.state){case "redundant":e("onUpdateFailed");d.onstatechange=null;break;case "installing":h||e("onUpdating");break;case "installed":g||e("onUpdateReady");break;case "activated":e("onUpdated"),d.onstatechange=null}}function c(){switch(d.state){case "redundant":d.onstatechange=null;break;case "activated":e("onInstalled"),d.onstatechange=null}}var d=a.installing||a.waiting,
g;if(d&&!d.onstatechange){if(a.active){b();var f=b}else c(),f=c;var h=!0;a.waiting&&(g=!0);d.onstatechange=f}},e=function(a){if("function"===typeof d[a])d[a]({source:"ServiceWorker"})};navigator.serviceWorker.register("sw.js").then((function(a){a&&(c(a),a.onupdatefound=function(){c(a)})})).catch((function(a){e("onError");return Promise.reject(a)}))}else if(window.applicationCache){var l=function(){var a=document.createElement("iframe");window.addEventListener("message",(function(b){if(b.source===a.contentWindow&&
(b=(b.data+"").match(/__offline-plugin_AppCacheEvent:(\w+)/)[1],"function"===typeof d[b]))d[b]({source:"AppCache"})}));a.src="appcache/manifest.html";a.style.display="none";b=a;document.body.appendChild(a)};"complete"===document.readyState?setTimeout(l):window.addEventListener("load",l)}};e.applyUpdate=function(d,c){if(a())navigator.serviceWorker.getRegistration().then((function(a){a&&a.waiting?(a.waiting.postMessage({action:"skipWaiting"}),d&&d()):c&&c()}));else if(b)try{b.contentWindow.__applyUpdate(),
d&&setTimeout(d)}catch(f){c&&setTimeout(c)}};e.update=function(){a()&&navigator.serviceWorker.getRegistration().then((function(a){if(a)return a.update()}));if(b)try{b.contentWindow.applicationCache.update()}catch(d){}}})]);