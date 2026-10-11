const panel = document.querySelector('#panel');
const toast = document.querySelector('#toast');
let scene = 'signup';
let visibleRuleCount = 0;
let toastTimer;
let waitTimer;
let enteredDetails = null;
let chosenHandle = '';
let awardId = '';
const pendingTimers = new Set();
function schedule(callback, delay) {
  const timer = setTimeout(() => { pendingTimers.delete(timer); callback(); }, delay);
  pendingTimers.add(timer);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function notice(message, kind = 'error') {
  const target = panel.querySelector('.form-notice');
  if (!target) return;
  target.className = `form-notice ${kind === 'error' ? '' : kind}`;
  target.textContent = message;
}
function blockPaste(input) {
  for (const eventType of ['paste', 'drop']) input.addEventListener(eventType, event => {
    event.preventDefault();
    notify('For security, please type that in again.');
  });
}
function blockCopy(input) {
  input.addEventListener('copy', event => {
    event.preventDefault();
    notify('Copy is unavailable for this field.');
  });
}
function moveTo(next) {
  scene = next;
  clearInterval(waitTimer);
  pendingTimers.forEach(clearTimeout);
  pendingTimers.clear();
  document.querySelector('#captchaDialog')?.remove();
  document.querySelector('#certaintyDialog')?.remove();
  if (next === 'signup' || next === 'login') { enteredDetails = null; chosenHandle = ''; awardId = ''; }
  render();
  if (window.innerWidth < 761) document.querySelector('.form-section').scrollIntoView({behavior:'smooth',block:'start'});
  else window.scrollTo({top:0,behavior:'smooth'});
}
function frame(title, subtitle, body) {
  panel.className = `form-card${scene === 'success' ? ' award-mode' : ''}`;
  panel.innerHTML = `<h2>${title}</h2><p class="subtitle">${subtitle}</p>${body}`;
}
function attachEyes() {
  panel.querySelectorAll('.eye').forEach(button => button.addEventListener('click', () => {
    const input = panel.querySelector(`#${button.dataset.for}`);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    const label = panel.querySelector(`label[for="${button.dataset.for}"]`)?.textContent.trim().toLowerCase() || 'password';
    button.setAttribute('aria-label', `${visible ? 'Show' : 'Hide'} ${label}`);
    button.textContent = visible ? '◉' : '◎';
  }));
}
const sydneyParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit'
}).formatToParts(new Date()).map(part=>[part.type,part.value]));
const currentYear = sydneyParts.year;
const sydneyDayNumber = Date.UTC(Number(sydneyParts.year),Number(sydneyParts.month)-1,Number(sydneyParts.day))/86400000-Date.UTC(2026,0,1)/86400000;
const fallbackDailyDeenReferences = ['65:3','2:286','94:5-6','13:28','39:53','49:13','16:90','20:114','3:159','57:4','2:152','2:153','29:69','64:11','17:23-24','103:1-3'];
const dailyReferenceFor = references => references[((sydneyDayNumber%references.length)+references.length)%references.length];
let dailyDeenReference = dailyReferenceFor(fallbackDailyDeenReferences);
let wordleOpposite = '';
let favoriteBook = '';
const compact = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const digitSum = value => [...value].filter(char=>/\d/.test(char)).reduce((sum,char)=>sum+Number(char),0);
const digitTarget = () => digitSum(`${currentYear}${dailyDeenReference}${compact(favoriteBook)}`)+7;
const passwordRules = [
  {text:'Use at least 10 characters.', test:value=>value.length>=10},
  {text:'Include an uppercase letter.', test:value=>/[A-Z]/.test(value)},
  {text:'Include a number.', test:value=>/\d/.test(value)},
  {text:'Include a special character.', test:value=>/[^\w\s]/.test(value)},
  {text:'Include a lowercase letter, too.', test:value=>/[a-z]/.test(value)},
  {text:'Include “Sydney”.', test:value=>/sydney/i.test(value)},
  {text:'End with an exclamation mark.', test:value=>value.endsWith('!')},
  {text:`Include the current year (${currentYear}).`, test:value=>value.includes(currentYear)},
  {text:'Include exactly one hyphen.', test:value=>(value.match(/-/g)||[]).length===1},
  {text:'Include “study”.', test:value=>/study/i.test(value)},
  {text:'Use an odd number of characters.', test:value=>value.length%2===1},
  {text:'Do not repeat a character three times in a row.', test:value=>!(/(.)\1\1/i.test(value))},
  {text:'Do not use spaces.', test:value=>!(/\s/.test(value))},
  {key:'wordle',text:'Include your opposite of today’s Wordle answer.',source:{label:'Play Wordle',url:'https://www.nytimes.com/games/wordle/index.html'},test:value=>/^[a-z]{2,24}$/i.test(wordleOpposite)&&value.toLowerCase().includes(wordleOpposite.toLowerCase())},
  {key:'daily-deen',text:'Include today’s Daily Deen verse reference (Surah:Ayah).',source:{label:'Open Daily Deen',url:'https://dailydeen.zubibair.com/'},test:value=>value.includes(dailyDeenReference)},
  {key:'book',text:'Include the title of your favourite book, without spaces or punctuation.',test:value=>compact(favoriteBook).length>=2&&value.toLowerCase().includes(compact(favoriteBook))},
  {text:()=>`Make every digit in the password add up to ${digitTarget()}.`,test:value=>digitSum(value)===digitTarget()}
];
const wordleRuleIndex = passwordRules.findIndex(rule=>rule.key==='wordle');
const bookRuleIndex = passwordRules.findIndex(rule=>rule.key==='book');
const dailyDeenRuleIndex = passwordRules.findIndex(rule=>rule.key==='daily-deen');
const ruleLabel = rule => typeof rule.text==='function'?rule.text():rule.text;
async function refreshDailyDeenReference() {
  try {
    const response=await fetch('https://dailydeen.zubibair.com/app.js',{mode:'cors',cache:'no-cache'});
    if(!response.ok) return;
    const source=await response.text();
    const start=source.indexOf('verses: [');
    const end=source.indexOf('  duas:',start);
    const extraStart=source.indexOf('readings.verses.push(');
    const extraEnd=source.indexOf(');',extraStart);
    if(start<0||end<0) return;
    const verseCode=source.slice(start,end)+(extraStart<0||extraEnd<0?'':source.slice(extraStart,extraEnd));
    const references=[...verseCode.matchAll(/\bsource:\s*"Qur'an\s+(\d{1,3}:\d{1,3}(?:-\d{1,3})?)"/g)].map(match=>match[1]);
    if(references.length>=10&&scene==='signup'&&visibleRuleCount<=dailyDeenRuleIndex) dailyDeenReference=dailyReferenceFor(references);
  } catch { /* The bundled rotation remains usable if Daily Deen is offline. */ }
}
const initialRuleCount = 4;
function renderSignup() {
  visibleRuleCount = 0;
  wordleOpposite = '';
  favoriteBook = '';
  frame('Create your planning space','Save courses you like, compare them later and close at least a few tabs.',`
    <form id="signupForm" novalidate>
      <div class="field"><label for="email">Email address</label><input id="email" type="email" placeholder="you@example.com" autocomplete="off" required></div>
      <div class="field"><label for="emailAgain">Confirm email address</label><input id="emailAgain" type="email" placeholder="you@example.com" autocomplete="off" required></div>
      <div class="field"><label for="password">Password</label><div class="input-wrap"><input id="password" type="password" placeholder="Create a password" autocomplete="new-password" required><button type="button" class="eye" data-for="password" aria-label="Show password">◉</button></div></div>
      <div class="rules" id="rules" hidden><p class="rules-title">Password requirements</p><ul id="ruleList"></ul>
        <div class="challenge-field" id="wordleField" hidden><label for="wordleOpposite">Your opposite for today’s Wordle answer</label><input id="wordleOpposite" type="text" autocomplete="off" maxlength="24" placeholder="One word, please"><small>Choose a reasonable opposite. We’ll take your word for it; your password has to as well.</small></div>
        <div class="challenge-field" id="bookField" hidden><label for="favoriteBook">Your favourite book</label><input id="favoriteBook" type="text" autocomplete="off" maxlength="70" placeholder="Book title"><small>Put the title in your password with spaces and punctuation removed.</small></div>
      </div>
      <div class="field"><label for="passwordAgain">Confirm password</label><div class="input-wrap"><input id="passwordAgain" type="password" placeholder="Confirm your password" autocomplete="new-password" required><button type="button" class="eye" data-for="passwordAgain" aria-label="Show confirmed password">◉</button></div></div>
      <p class="demo-hint">Preview only: use a made-up email and password. Nothing is sent to a server or used to create a real account.</p>
      <p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Create planning space</button>
    </form>`);
  attachEyes();
  const form = panel.querySelector('#signupForm');
  const email = panel.querySelector('#email');
  const emailAgain = panel.querySelector('#emailAgain');
  const password = panel.querySelector('#password');
  const passwordAgain = panel.querySelector('#passwordAgain');
  const wordleInput = panel.querySelector('#wordleOpposite');
  const bookInput = panel.querySelector('#favoriteBook');
  blockPaste(emailAgain); blockPaste(passwordAgain);
  blockCopy(email); blockCopy(password);
  const updateRules = () => {
    panel.querySelectorAll('#ruleList li').forEach(row => {
      const rule = passwordRules[Number(row.dataset.rule)];
      const met = rule.test(password.value);
      row.querySelector('.rule-copy').textContent = ruleLabel(rule);
      row.classList.toggle('met',met);
      row.setAttribute('aria-label',`${met ? 'Met' : 'Not met'}: ${ruleLabel(rule)}`);
    });
  };
  const revealThrough = count => {
    const list = panel.querySelector('#ruleList');
    for (let index=visibleRuleCount; index<count; index++) {
      const row = document.createElement('li');
      row.dataset.rule = String(index);
      const content = document.createElement('span');
      const copy = document.createElement('span');
      copy.className = 'rule-copy';
      copy.textContent = ruleLabel(passwordRules[index]);
      content.append(copy);
      if(passwordRules[index].source) {
        const link=document.createElement('a');
        link.href=passwordRules[index].source.url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=passwordRules[index].source.label+' ↗';
        content.append(' ',link);
      }
      row.append(content);
      list.append(row);
    }
    visibleRuleCount = count;
    panel.querySelector('#rules').hidden = false;
    panel.querySelector('#wordleField').hidden = visibleRuleCount<=wordleRuleIndex;
    panel.querySelector('#bookField').hidden = visibleRuleCount<=bookRuleIndex;
    updateRules();
  };
  wordleInput.addEventListener('input',()=>{wordleOpposite=wordleInput.value.trim();updateRules();});
  bookInput.addEventListener('input',()=>{favoriteBook=bookInput.value.trim();updateRules();});
  password.addEventListener('input', () => {
    if (passwordAgain.value) { passwordAgain.value=''; notice('Please confirm your updated password.','info'); }
    updateRules();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const address = email.value.trim();
    if (!email.validity.valid || !address.includes('.')) return notice('Enter a valid email address to continue.');
    if (address.toLowerCase() !== emailAgain.value.trim().toLowerCase()) return notice('The email addresses do not match.');
    if (!password.value) return notice('Enter a password to continue.');
    if (password.value !== passwordAgain.value) return notice('The passwords do not match. Please type it again.');

    const previousRuleCount = visibleRuleCount;
    if (visibleRuleCount === 0) revealThrough(initialRuleCount);

    // Keep revealing rules the current password already satisfies in this one attempt.
    // Stop at the first new requirement that actually needs a change.
    let unmet = passwordRules.slice(0,visibleRuleCount).find(rule => !rule.test(password.value));
    while (!unmet && visibleRuleCount < passwordRules.length) {
      revealThrough(visibleRuleCount + 1);
      const newestRule = passwordRules[visibleRuleCount - 1];
      if (!newestRule.test(password.value)) unmet = newestRule;
    }
    if (unmet) {
      if (visibleRuleCount > previousRuleCount) {
        passwordAgain.value = '';
        notice(`${ruleLabel(unmet)} Please confirm your password again.`, 'info');
      } else {
        notice(ruleLabel(unmet));
      }
      password.focus();
      return;
    }
    enteredDetails = {email:address.toLowerCase(), password:password.value};
    form.reset();
    moveTo('captcha');
  });
}

const challenges = [
  {name:'traffic lights', detail:'Select all squares with traffic lights.', answer:[0,4,7]},
  {name:'bicycles', detail:'Please complete this additional check.', answer:[1,3,6]},
  {name:'anything that is not a bus', detail:'Include all matching road objects.', answer:[0,1,3,4,6,7]},
  {name:'traffic lights that are not red', detail:'Amber and green count. The red one does not.', answer:[4,7]},
  {name:'things with wheels, except buses', detail:'Buses do not count for this round.', answer:[1,3,6]},
  {name:'every single square', detail:'Select the full image set to complete verification.', answer:[0,1,2,3,4,5,6,7,8]}
];
const shapeTiles = [
  {shape:'triangle',color:'blue',turn:0}, {shape:'circle',color:'blue',turn:0}, {shape:'triangle',color:'coral',turn:90},
  {shape:'diamond',color:'blue',turn:0}, {shape:'triangle',color:'blue',turn:180}, {shape:'square',color:'coral',turn:0},
  {shape:'pentagon',color:'blue',turn:0}, {shape:'star',color:'coral',turn:0}, {shape:'triangle',color:'blue',turn:270}
];
const shapeQuestions = [
  {name:'every triangle',detail:'Turned triangles are still triangles.',answer:[0,2,4,8]},
  {name:'only the blue triangles',detail:'A blue diamond is not a triangle.',answer:[0,4,8]}
];
function shapeArt(item) {
  const forms = {
    triangle:'<polygon points="50,14 85,79 15,79"/>', circle:'<circle cx="50" cy="50" r="31"/>',
    diamond:'<polygon points="50,12 88,50 50,88 12,50"/>', square:'<rect x="21" y="21" width="58" height="58" rx="3"/>',
    pentagon:'<polygon points="50,11 87,38 73,83 27,83 13,38"/>', star:'<polygon points="50,9 59,37 88,37 65,55 74,84 50,67 26,84 35,55 12,37 41,37"/>'
  };
  return `<svg viewBox="0 0 100 100" aria-hidden="true" style="transform:rotate(${item.turn}deg)"><g fill="${item.color==='blue'?'#3d7bd5':'#ee8769'}">${forms[item.shape]}</g></svg>`;
}
function renderCaptcha() {
  let challengeIndex = 0;
  let shapeRound = 0;
  let equationDone = false;
  let chosen = new Set();
  let refreshOffset = 0;
  frame('Confirm it’s you','We just need to run a quick security check.',`
    <div class="captcha-widget">
      <button type="button" class="captcha-checkbox" id="robotCheck" aria-label="I'm not a robot" aria-haspopup="dialog" aria-expanded="false"><span class="captcha-checkbox-square" aria-hidden="true"></span><span>I'm not a robot</span></button>
      <div class="captcha-widget-brand" aria-hidden="true"><span class="captcha-widget-mark">S</span><small>SCF verify<br><span>Privacy · Terms</span></small></div>
    </div>
    <p class="captcha-under-note">Please complete verification to continue.</p>`);
  const checkbox = panel.querySelector('#robotCheck');
  const dialog = document.createElement('dialog');
  dialog.id = 'captchaDialog';
  dialog.className = 'captcha-dialog';
  document.body.append(dialog);
  dialog.addEventListener('close', () => checkbox.setAttribute('aria-expanded','false'));
  checkbox.addEventListener('click', () => {
    checkbox.setAttribute('aria-expanded','true');
    chosen.clear();
    if(challengeIndex<challenges.length) paint();
    else if(shapeRound<shapeQuestions.length) paintShapes();
    else if(!equationDone) paintEquation();
    else paintFinal();
    dialog.showModal();
  });
  function paint(message = '') {
    const current = challenges[challengeIndex];
    dialog.innerHTML = `
      <div class="captcha-dialog-header"><span>Select all images with</span><strong>${current.name}</strong><small>${current.detail}</small></div>
      <div class="captcha-dialog-body"><div class="captcha-grid" role="group" aria-label="Image challenge">${Array.from({length:9},(_,index)=>{
        const photo=(index+refreshOffset)%9;
        return `<button type="button" class="tile" data-tile="${index}" data-photo="${photo}" aria-label="Image ${index+1}" aria-pressed="false" style="background-position:${(photo%3)*50}% ${Math.floor(photo/3)*50}%"></button>`;
      }).join('')}</div><p class="captcha-message" role="status" aria-live="polite">${message}</p></div>
      <div class="captcha-dialog-footer"><div class="captcha-dialog-tools"><button type="button" id="refreshChallenge" aria-label="Get a new image layout" title="Get a new layout">↻</button><button type="button" id="challengeHelp" aria-label="Challenge help" title="Help">?</button></div><button type="button" class="captcha-verify" id="verify">VERIFY</button></div>`;
    dialog.querySelectorAll('.tile').forEach(tile => tile.addEventListener('click', () => {
      const index=Number(tile.dataset.tile);
      chosen.has(index) ? chosen.delete(index) : chosen.add(index);
      tile.classList.toggle('selected',chosen.has(index));
      tile.setAttribute('aria-pressed',String(chosen.has(index)));
    }));
    dialog.querySelector('#refreshChallenge').addEventListener('click', () => {chosen.clear();refreshOffset=(refreshOffset+1)%9;paint('The images have been rearranged.');});
    dialog.querySelector('#challengeHelp').addEventListener('click', () => {dialog.querySelector('.captcha-message').textContent='Select every square matching the instruction above, then press VERIFY.';});
    dialog.querySelector('#verify').addEventListener('click', () => {
      const answers = [...dialog.querySelectorAll('.tile')].filter(tile=>current.answer.includes(Number(tile.dataset.photo))).map(tile=>Number(tile.dataset.tile));
      const right=answers.length===chosen.size && answers.every(index=>chosen.has(index));
      if(!right){chosen.clear();refreshOffset=(refreshOffset+1)%9;paint('That was close. Please try the new layout.');return;}
      challengeIndex++;
      refreshOffset=(refreshOffset+2)%9;
      chosen.clear();
      if(challengeIndex<challenges.length) paint('Additional verification required.');
      else paintShapes('Continue with the shape check.');
    });
  }
  function paintShapes(message = '') {
    const current = shapeQuestions[shapeRound];
    dialog.innerHTML = `<div class="captcha-dialog-header"><span>Select</span><strong>${current.name}</strong><small>${current.detail}</small></div>
      <div class="captcha-dialog-body"><div class="captcha-grid shape-grid" role="group" aria-label="Shape challenge">${Array.from({length:9},(_,index)=>{
        const shapeIndex=(index+refreshOffset)%9;
        return `<button type="button" class="shape-tile" data-tile="${index}" data-shape="${shapeIndex}" aria-label="Shape ${index+1}" aria-pressed="false">${shapeArt(shapeTiles[shapeIndex])}</button>`;
      }).join('')}</div><p class="captcha-message" role="status" aria-live="polite">${message}</p></div>
      <div class="captcha-dialog-footer"><div class="captcha-dialog-tools"><button type="button" id="refreshChallenge" aria-label="Rotate shapes" title="Rotate shapes">↻</button><button type="button" id="challengeHelp" aria-label="Challenge help" title="Help">?</button></div><button type="button" class="captcha-verify" id="verify">VERIFY</button></div>`;
    dialog.querySelectorAll('.shape-tile').forEach(tile=>tile.addEventListener('click',()=>{
      const index=Number(tile.dataset.tile);
      chosen.has(index) ? chosen.delete(index) : chosen.add(index);
      tile.classList.toggle('selected',chosen.has(index));
      tile.setAttribute('aria-pressed',String(chosen.has(index)));
    }));
    dialog.querySelector('#refreshChallenge').addEventListener('click',()=>{chosen.clear();refreshOffset=(refreshOffset+1)%9;paintShapes('The shapes have been rearranged.');});
    dialog.querySelector('#challengeHelp').addEventListener('click',()=>{dialog.querySelector('.captcha-message').textContent='Look at the shape and colour of each square, then press VERIFY.';});
    dialog.querySelector('#verify').addEventListener('click',()=>{
      const answers=[...dialog.querySelectorAll('.shape-tile')].filter(tile=>current.answer.includes(Number(tile.dataset.shape))).map(tile=>Number(tile.dataset.tile));
      const right=answers.length===chosen.size && answers.every(index=>chosen.has(index));
      chosen.clear();
      if(!right){refreshOffset=(refreshOffset+1)%9;paintShapes('Not quite. Try the rearranged shapes.');return;}
      shapeRound++;
      refreshOffset=(refreshOffset+2)%9;
      if(shapeRound<shapeQuestions.length) paintShapes('Continue with the next shape set.');
      else paintEquation();
    });
  }
  function paintEquation() {
    dialog.innerHTML=`<div class="captcha-dialog-header"><span>Final verification check</span><strong>Solve this equation</strong><small>Enter the result to continue.</small></div>
      <form class="captcha-math" id="captchaMath" novalidate><div class="captcha-math-problem">8 <span>+</span> 5 <span>=</span> ?</div><label for="mathAnswer">Your answer</label><input id="mathAnswer" type="number" inputmode="numeric" autocomplete="off" placeholder="Enter a number" required><p class="captcha-message" role="status" aria-live="polite"></p><button type="submit" class="captcha-verify">VERIFY ANSWER</button></form>`;
    dialog.querySelector('#captchaMath').addEventListener('submit',event=>{
      event.preventDefault();
      const answer=dialog.querySelector('#mathAnswer');
      if(answer.value.trim()!=='13') {answer.value='';dialog.querySelector('.captcha-message').textContent='That answer did not add up. Try again.';answer.focus();return;}
      equationDone=true;
      paintFinal();
    });
  }
  function paintFinal() {
    dialog.innerHTML=`<div class="captcha-dialog-header"><span>Verification complete</span><strong>Confirm your result</strong><small>Submit the completed check.</small></div><div class="captcha-final"><div class="captcha-final-icon" aria-hidden="true">✓</div><p>Confirm this result to continue setting up your planning space.</p><button type="button" class="captcha-verify" id="finalVerify">CONFIRM VERIFICATION</button></div>`;
    dialog.querySelector('#finalVerify').addEventListener('click',()=>{
      dialog.close();
      checkbox.classList.add('verified');
      checkbox.querySelector('.captcha-checkbox-square').textContent='✓';
      checkbox.querySelector('span:last-child').textContent='Verified';
      checkbox.setAttribute('aria-label','Verified');
      panel.querySelector('.captcha-under-note').textContent='Thanks. Please continue.';
      schedule(()=>moveTo('username'),700);
    });
  }
}
function renderUsername() {
  const unavailable = new Set();
  let setbacks = 0;
  let checkedName = '';
  frame('Choose a profile name','This name will label your saved course lists. The good ones go quickly.',`
    <form id="usernameForm" novalidate>
      <div class="field"><label for="username">Username</label><div class="handle-input"><span aria-hidden="true">@</span><input id="username" type="text" placeholder="Your username" autocomplete="off" maxlength="18" spellcheck="false" required></div></div>
      <p class="field-help">Use 4–18 letters, numbers or underscores. Spaces are unavailable for profile names.</p>
      <div class="availability" id="availability" role="status" aria-live="polite"></div>
      <p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Check availability</button>
    </form>`);
  const form=panel.querySelector('#usernameForm');
  const input=panel.querySelector('#username');
  const status=panel.querySelector('#availability');
  const button=form.querySelector('button[type="submit"]');
  const suggest=(value,suffix)=>`${value.replace(/_[23]$/,'').slice(0,16)}_${suffix}`;
  const showTaken=(message,suggestion)=>{
    status.className='availability visible';
    status.innerHTML=`<strong>${message}</strong><span>Suggested alternative:</span><button type="button" class="suggestion" id="suggestHandle"></button>`;
    status.querySelector('#suggestHandle').textContent=`@${suggestion}`;
    status.querySelector('#suggestHandle').addEventListener('click',()=>{input.value=suggestion;input.focus();notice('Suggestion added. Check availability again.','info');});
    button.textContent='Check availability';
    checkedName='';
  };
  input.addEventListener('input',()=>{
    if(checkedName && input.value.trim().toLowerCase()!==checkedName){
      checkedName='';
      status.className='availability';
      status.textContent='';
      button.textContent='Check availability';
    }
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const value=input.value.trim();
    if(!/^[A-Za-z0-9_]{4,18}$/.test(value)) return notice('Use 4–18 letters, numbers, or underscores.');
    const normalised=value.toLowerCase();
    if(unavailable.has(normalised)) return notice('That name is still unavailable. Please choose a different one.');
    if(checkedName===normalised){
      if(setbacks===1){
        setbacks=2;
        unavailable.add(normalised);
        showTaken('Availability changed during reservation.',suggest(value,3));
        notice('That profile name is no longer available. Please choose another.','info');
        return;
      }
      chosenHandle=value;
      moveTo('code');
      return;
    }
    if(setbacks===0){
      setbacks=1;
      unavailable.add(normalised);
      showTaken('That username is already taken.',suggest(value,2));
      notice('Please select a different profile name.','info');
      return;
    }
    checkedName=normalised;
    status.className='availability visible available';
    status.innerHTML='<strong>This profile name is currently available.</strong><span>Reserve it to continue.</span>';
    button.textContent='Reserve username';
    notice('Availability check complete.','info');
  });
}
function renderCode() {
  let currentCode='482913';
  let expired=false;
  frame('Verify your email','Enter the six-digit code from the preview inbox below. Conveniently, it is right here.',`
    <div class="demo-inbox"><div class="inbox-top"><span class="inbox-icon" aria-hidden="true">✉</span><div><strong>Preview inbox</strong><small>No email is sent. Open this local preview message for your code.</small></div></div><button type="button" class="link-button" id="openInbox" aria-expanded="false">Open verification message</button><div class="inbox-message" id="inboxMessage" hidden><div class="inbox-meta">From: Sydney Course Finder preview</div><p>Your verification code is</p><strong id="inboxCode">482913</strong><small>Use the latest code shown here.</small></div></div>
    <form id="codeForm" novalidate><div class="field"><label for="verificationCode">Verification code</label><input id="verificationCode" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="off" placeholder="Six digits" required></div><p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Verify code</button></form>`);
  const inbox=panel.querySelector('#inboxMessage');
  const input=panel.querySelector('#verificationCode');
  const opener=panel.querySelector('#openInbox');
  blockPaste(input);
  opener.addEventListener('click',()=>{
    const opening=inbox.hidden;
    inbox.hidden=!opening;
    opener.textContent=opening?'Close verification message':'Open verification message';
    opener.setAttribute('aria-expanded',String(opening));
  });
  panel.querySelector('#codeForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(input.value!==currentCode) return notice('That code does not match the latest email.');
    if(!expired){
      expired=true;
      currentCode='734206';
      input.value='';
      panel.querySelector('#inboxCode').textContent=currentCode;
      notice('That code expired. A new preview code has been issued.','info');
      inbox.hidden=false;
      opener.textContent='Close verification message';
      opener.setAttribute('aria-expanded','true');
      input.focus();
      return;
    }
    moveTo('cookies');
  });
}
function renderCookies() {
  frame('Your privacy matters','Choose how you would like us to use cookies.',`
    <div class="cookie-box"><h3>Cookie preferences</h3><p>Necessary cookies keep the experience working. Optional cookies help us understand how visitors use the site.</p>
      <div class="button-row"><button class="button button-primary" type="button" id="acceptAll">Accept all</button><button class="link-button" type="button" id="customise">Customise settings</button></div><div id="cookieSettings" hidden></div></div>`);
  panel.querySelector('#acceptAll').addEventListener('click',()=>moveTo('notifications'));
  panel.querySelector('#customise').addEventListener('click',()=>{
    const target=panel.querySelector('#cookieSettings');
    target.hidden=false;
    target.innerHTML=`<div class="setting-list"><div class="setting-row"><span><strong>Essential</strong><small>Always active</small></span><button type="button" class="switch" aria-label="Essential cookies on" aria-pressed="true" disabled></button></div><div class="setting-row"><span><strong>Analytics</strong><small>Help us improve the experience</small></span><button type="button" class="switch" aria-label="Analytics cookies" aria-pressed="true"></button></div><div class="setting-row"><span><strong>Personalisation</strong><small>Remember your preferences</small></span><button type="button" class="switch" aria-label="Personalisation cookies" aria-pressed="true"></button></div></div><button type="button" class="button button-secondary full" id="saveCookies">Save my choices</button>`;
    target.querySelectorAll('.switch:not(:disabled)').forEach(switcher=>switcher.addEventListener('click',()=>toggleSwitch(switcher)));
    target.querySelector('#saveCookies').addEventListener('click',()=>moveTo('notifications'));
    panel.querySelector('#customise').hidden=true;
  });
}
function toggleSwitch(button) {
  const wasOn=button.getAttribute('aria-pressed')==='true';
  button.setAttribute('aria-pressed',String(!wasOn));
  button.classList.toggle('off',wasOn);
}
function renderNotifications() {
  const items=[['Course updates','Changes to courses in your shortlist.'],['Application reminders','Key planning dates and follow-ups.'],['Study recommendations','Suggested courses based on your interests.']];
  frame('Choose your updates','Select the course planning messages you want to receive. Your inbox gets a vote, too.',`
    <div class="setting-list">${items.map(([name,description],index)=>`<div class="setting-row"><span><strong>${name}</strong><small>${description}</small></span><button type="button" class="switch message-switch" data-index="${index}" aria-label="${name} on" aria-pressed="true"></button></div>`).join('')}</div>
    <p class="quiet-note" id="quietNote">Your preferences can be updated at any time.</p><p class="form-notice" aria-live="polite"></p><button type="button" class="button button-primary full" id="continueMessages">Save preferences</button>`);
  const switches=[...panel.querySelectorAll('.message-switch')];
  switches.forEach(button=>button.addEventListener('click',()=>{
    toggleSwitch(button);
    button.setAttribute('aria-label',`${items[Number(button.dataset.index)][0]} ${button.getAttribute('aria-pressed')==='true'?'on':'off'}`);
    const off=switches.filter(item=>item.getAttribute('aria-pressed')==='false').length;
    if(off===3) panel.querySelector('#quietNote').textContent='All notifications are now off.';
  }));
  panel.querySelector('#continueMessages').addEventListener('click',()=>{
    if(switches.some(button=>button.getAttribute('aria-pressed')==='true')) return notice('Please review all three notification settings before continuing.');
    moveTo('survey');
  });
}
function renderSurvey() {
  frame('Personalise your plan','Tell us what you want to explore first. Changing your mind later is allowed.',`
    <form id="surveyForm" novalidate>
      <div class="field"><label for="visitReason">What are you planning to do?</label><select id="visitReason" required><option value="">Choose one</option><option>Explore study areas</option><option>Compare entry requirements</option><option>Save a course shortlist</option></select></div>
      <fieldset class="survey-options"><legend>How did you hear about the course finder?</legend><label><input type="radio" name="discovery" value="search"> Search engine</label><label><input type="radio" name="discovery" value="school"> School or careers adviser</label><label><input type="radio" name="discovery" value="friend"> Friend or family</label></fieldset>
      <p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Save my answers</button><button class="link-button survey-skip" type="button" id="skipSurvey">Skip for now</button>
    </form>`);
  panel.querySelector('#skipSurvey').addEventListener('click',()=>notice('A planning goal is required before the space can be prepared.','info'));
  panel.querySelector('#surveyForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!panel.querySelector('#visitReason').value || !panel.querySelector('input[name="discovery"]:checked')) return notice('Please answer both questions before continuing.');
    moveTo('terms');
  });
}
const termsChapters = [
  {title:'Scope of this planning preview', clauses:[
    'This planning space is an interactive preview of a course organisation flow. It does not create a real account, retrieve personal enrolment records, or submit an application. Details entered during setup remain in the current browser tab and are cleared when the flow is completed or restarted.',
    'Course examples on the welcome screen are illustrations of study areas. They are not recommendations, offers, or statements that a particular program is currently open. Before making a decision, compare current information with the institution and the relevant admissions service.',
    'The preview may ask you to repeat information you entered earlier to confirm that the session remains active. For this reason, use only made-up contact details and a made-up password that you do not use for any real account.',
    'Sections of this notice include separate acknowledgement and preference controls. An acknowledgement records that you reviewed a section. An optional request changes a preference; leaving an optional request unticked leaves that preference unchanged.'
  ], mark:'I understand that this preview does not create an account.', trap:'Enable an additional identity review for this preview.'},
  {title:'Course information and decisions', clauses:[
    'Course names, campuses, delivery modes, entry requirements, selection ranks, prerequisites, fees and application dates may change. This preview does not verify live course data or guarantee that any example shown here will remain available when applications open.',
    'A selection rank can include adjustment factors and may differ from a raw ATAR. Meeting a published threshold may still be insufficient when a course has prerequisites, interviews, portfolios, limited places or other conditions determined by its provider.',
    'A saved list is a planning aid, not an application or expression of preference submitted to a university. The order of examples in this preview does not determine the order in which a real admissions centre considers course preferences.',
    'You should check current official course pages before relying on any planning note. If different sources describe a program differently, use the provider and admissions authority to confirm the current requirement for the intake that interests you.'
  ], mark:'I will confirm course requirements with official sources.'},
  {title:'Preferences and messages', clauses:[
    'Essential interface settings support the preview in this tab. Optional settings describe the kinds of reminders and recommendations a completed planning space might provide. This preview does not actually enrol you in an email or notification service.',
    'A setting can be reviewed without being enabled. To record your choice, inspect each control and leave it in the position that reflects your preference. The setup screen may require that all available controls have been reviewed before proceeding.',
    'The phrase “course update” can refer to a change in a course record, a planning prompt, or a recommendation based on an interest selected during setup. A preview message is not an official communication from a university or admissions centre.',
    'If you restart the preview, the choices you made in this tab may return to their starting positions. This behaviour does not affect settings at any other website, account, device or service.'
  ], mark:'I reviewed the planning preference controls.', trap:'Re-enable all optional planning messages for this session.'},
  {title:'Verification and local data', clauses:[
    'The verification steps in this preview are simulated. Completing an image, shape or number prompt does not verify your identity with an external service. The preview does not send your selected squares or typed answers to a server.',
    'A code shown in the preview inbox is generated for this local flow and is not an email or one-time password for another service. Only the latest code displayed in the preview inbox is accepted by the current setup session.',
    'Your made-up email and password are held temporarily in memory while this session is active. They are not written to local storage by this page. Closing or refreshing the tab also ends the session.',
    'Do not enter a real password, authentication code, private identifier or application detail into this preview. If you need to apply to a course, use the official provider or admissions service rather than this local setup demonstration.'
  ], mark:'I will use made-up details in this preview.'},
  {title:'Completion of the preview', clauses:[
    'The setup flow may recheck a previous answer before showing its final screen. A displayed percentage is a visual indication of the current preview step and may change when an additional local check begins.',
    'Completion of the preview does not open an account, save a course list online or grant admission to a program. It simply finishes the local sequence in this tab and clears the temporary made-up credentials used for its matching step.',
    'Any material displayed at completion belongs to this local preview. It has no monetary value and does not represent a university, admissions body or course provider. This browser experience is separate from official course and application services.',
    'This is the final section of the preview information. Review the controls associated with each section before continuing; scrolling to the end alone does not record those individual choices.'
  ], mark:'I reached the final section of this information.'}
];
function renderTerms() {
  const chapters = termsChapters.map((chapter, chapterIndex) => `<section class="terms-chapter">
    <h4>${chapter.title}</h4>${chapter.clauses.map((clause,index)=>`<p><span class="clause-number">${chapterIndex*4+index+1}.</span> ${clause}</p>`).join('')}
    ${chapter.mark ? `<label class="terms-tiny-check"><input type="checkbox" class="terms-mark" data-expected="true" aria-label="${chapter.mark}"><span>${chapter.mark}</span></label>` : ''}
    ${chapter.trap ? `<label class="terms-tiny-check"><input type="checkbox" class="terms-mark" data-expected="false" aria-label="${chapter.trap}"><span>${chapter.trap}</span></label>` : ''}
  </section>`).join('');
  frame('Review preview information','Read each section and record the relevant choices.',`
    <div class="terms-topline"><span>PREVIEW INFORMATION</span><span>Scroll to read</span></div>
    <div class="terms-box" id="terms" tabindex="0" aria-label="Preview information. Scroll through the document and review the small choices.">
      <h3>Planning preview information</h3><p class="terms-effective">Local browser session · Preview edition</p>${chapters}
    </div>
    <label class="check-row locked" id="agreementRow"><input id="agreement" type="checkbox" disabled> I have read the preview information.</label>
    <p class="form-notice" aria-live="polite"></p><button type="button" class="button button-primary full" id="termsContinue">Continue</button>`);
  const terms = panel.querySelector('#terms');
  const marks = [...panel.querySelectorAll('.terms-mark')];
  const agreement = panel.querySelector('#agreement');
  const updateScroll = () => {
    if (terms.scrollTop + terms.clientHeight >= terms.scrollHeight - 8) {
      agreement.disabled = false;
      panel.querySelector('#agreementRow').classList.remove('locked');
    }
  };
  marks.forEach(mark=>mark.addEventListener('change',()=>{
    mark.closest('.terms-tiny-check').classList.toggle('acknowledged',mark.checked);
  }));
  terms.addEventListener('scroll',updateScroll);
  updateScroll();
  panel.querySelector('#termsContinue').addEventListener('click',()=>{
    if(agreement.disabled) return notice('Please scroll through the final section.');
    if(!agreement.checked) return notice('Please tick the agreement box.');
    if(marks.some(mark=>mark.checked!==(mark.dataset.expected==='true'))) return notice('One or more tiny choices contradict what you agreed to. Review the terms again.');
    moveTo('waiting');
  });
}
function renderWaiting() {
  frame('Preparing your planning space','Your preferences and verification are being reviewed.',`
    <div class="loading-scene"><div class="loading-kicker">PLANNING SPACE SETUP</div><div class="loading-number" id="loadNumber">0%</div>
    <div class="loading-track" role="progressbar" aria-label="Setup progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="loading-fill" id="loadFill"></div></div>
    <p class="loading-caption" id="loadCaption" aria-live="polite">Reviewing your settings...</p><div class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>`);
  const dialog = document.createElement('dialog');
  dialog.id = 'certaintyDialog';
  dialog.className = 'certainty-dialog';
  dialog.addEventListener('cancel',event=>event.preventDefault());
  document.body.append(dialog);
  const setProgress = value => {
    panel.querySelector('#loadNumber').textContent = `${value}%`;
    panel.querySelector('#loadFill').style.width = `${value}%`;
    panel.querySelector('.loading-track').setAttribute('aria-valuenow',String(value));
  };
  const confirmations = [
    {eyebrow:'SETUP REVIEW', title:'Confirm your setup request', body:'Your planning preferences are ready to be submitted for this preview session.', button:'Confirm setup'},
    {eyebrow:'SECONDARY REVIEW', title:'Confirm your previous choice', body:'A second confirmation is required before the planning space can open.', button:'Confirm again'},
    {eyebrow:'FINAL REVIEW', title:'Complete setup?', body:'The preview has finished its last local check. Confirm once more to continue.', button:'Complete setup'}
  ];
  function ask(index) {
    if (scene !== 'waiting') return;
    const item = confirmations[index];
    dialog.innerHTML = `<span class="certainty-eyebrow">${item.eyebrow}</span><div class="certainty-icon" aria-hidden="true">?</div><h3>${item.title}</h3><p>${item.body}</p><button type="button" class="button button-primary full" id="certaintyYes">${item.button}</button>`;
    dialog.showModal();
    dialog.querySelector('#certaintyYes').addEventListener('click',()=>{
      dialog.close();
      if(index===0) schedule(()=>ask(1),350);
      else if(index===1){panel.querySelector('#loadCaption').textContent='Finishing final review...';schedule(()=>ask(2),2600);}
      else {setProgress(100);panel.querySelector('#loadCaption').textContent='Setup review complete.';schedule(()=>moveTo('quiz'),850);}
    });
  }
  const phases = [
    {duration:4800, start:0, end:24, caption:'Reviewing your settings...'},
    {duration:1300, start:24, end:94, caption:'Preparing your course workspace...'},
    {duration:4200, start:94, end:99, caption:'Completing initial checks...'},
    {duration:1900, start:99, end:99, caption:'Waiting for the final check...'},
    {duration:900, start:99, end:78, caption:'Revalidating your settings...'},
    {duration:3300, start:78, end:96, caption:'Reconfirming your preferences...'},
    {duration:4300, start:96, end:99, caption:'Completing the second review...'},
    {duration:2500, start:99, end:99, caption:'Waiting for setup confirmation...'}
  ];
  const total = phases.reduce((sum,phase)=>sum+phase.duration,0);
  const started = performance.now();
  waitTimer = setInterval(()=>{
    if(scene!=='waiting'){clearInterval(waitTimer);return;}
    let elapsed = Math.min(performance.now()-started,total);
    for(const phase of phases){
      if(elapsed<=phase.duration){
        setProgress(Math.round(phase.start+(phase.end-phase.start)*elapsed/phase.duration));
        panel.querySelector('#loadCaption').textContent=phase.caption;
        break;
      }
      elapsed-=phase.duration;
    }
    if(performance.now()-started>=total){
      clearInterval(waitTimer);
      setProgress(99);
      panel.querySelector('#loadCaption').textContent='Your confirmation is required to continue.';
      schedule(()=>ask(0),450);
    }
  },90);
}
function renderQuiz() {
  if(!enteredDetails) return moveTo('signup');
  frame('Confirm your details','Re-enter the details used for this preview session.',`
    <div class="quiz-badge"><span aria-hidden="true">✦</span> FINAL ACCOUNT CHECK</div>
    <form id="quizForm" novalidate>
      <div class="field"><label for="rememberedEmail">Email address</label><input id="rememberedEmail" type="email" placeholder="Re-enter the address from setup" autocomplete="off" required></div>
      <div class="field"><label for="rememberedPassword">Preview password</label><div class="input-wrap"><input id="rememberedPassword" type="password" placeholder="Re-enter your made-up password" autocomplete="off" required><button type="button" class="eye" data-for="rememberedPassword" aria-label="Show remembered password">◉</button></div></div>
      <p class="quiz-hint">Use the same made-up details from setup. Your answers remain in this tab and are cleared when you finish.</p>
      <p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Open my planning space</button>
    </form>`);
  attachEyes();
  const email = panel.querySelector('#rememberedEmail');
  const password = panel.querySelector('#rememberedPassword');
  blockPaste(email);
  blockPaste(password);
  panel.querySelector('#quizForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(email.value.trim().toLowerCase()!==enteredDetails.email || password.value!==enteredDetails.password){
      password.value='';
      notice('Those details do not match the ones entered during setup.');
      password.focus();
      return;
    }
    enteredDetails=null;
    moveTo('success');
  });
}
function downloadPatiencePass() {
  if(!awardId) return;
  const name=chosenHandle || 'patient_human';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">Patience Pass awarded to ${name}</title><desc id="desc">A personalised digital certificate of persistence.</desc><defs><radialGradient id="bg"><stop stop-color="#203e66"/><stop offset="1" stop-color="#07172d"/></radialGradient><linearGradient id="gold" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff0b5"/><stop offset=".52" stop-color="#d59b40"/><stop offset="1" stop-color="#f7d889"/></linearGradient><pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#d8b66d" opacity=".27"/></pattern></defs><rect width="1200" height="675" fill="url(#bg)"/><rect width="1200" height="675" fill="url(#dots)"/><rect x="23" y="23" width="1154" height="629" rx="18" fill="none" stroke="#d7ad61" stroke-width="2"/><rect x="35" y="35" width="1130" height="605" rx="11" fill="none" stroke="#d7ad61" stroke-opacity=".38"/><circle cx="600" cy="191" r="91" fill="#d2a351" opacity=".12"/><path d="M561 132h78v62c0 32-16 53-39 53s-39-21-39-53v-62Z" fill="url(#gold)"/><path d="M561 143h-24v30c0 20 13 32 33 33m69-63h24v30c0 20-13 32-33 33" fill="none" stroke="#d8a34a" stroke-width="9"/><path d="M596 247h8v26h-8zm-23 26h54v12h-54z" fill="#d8a34a"/><text x="600" y="331" fill="#e7c783" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="6">OFFICIALLY UNLOCKED</text><text x="600" y="403" fill="#fff4da" text-anchor="middle" font-family="Georgia,serif" font-size="64">The Patience Pass</text><text x="600" y="458" fill="#cfdbeb" text-anchor="middle" font-family="Arial,sans-serif" font-size="25">Awarded to @${name}</text><path d="M396 494h408" stroke="#d8aa5d" stroke-opacity=".6"/><text x="600" y="537" fill="#edd3a0" text-anchor="middle" font-family="Arial,sans-serif" font-size="18">SURVIVED EVERY CHECK, EVERY BOX, EVERY “ONE LAST THING”</text><text x="94" y="607" fill="#91a9c7" font-family="Arial,sans-serif" font-size="17">${currentYear} · MILDLY INFURIATING</text><text x="1106" y="607" text-anchor="end" fill="#91a9c7" font-family="Arial,sans-serif" font-size="17">PASS #${awardId}</text></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=`patience-pass-${name.toLowerCase()}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderSuccess() {
  if(!awardId) awardId=Math.random().toString(36).slice(2,8).toUpperCase();
  frame('Surprise. That was mildly infuriating.','The course finder setup was a patience test. You made it to the real ending.',`
    <div class="reveal-banner"><strong>THE REVEAL</strong><p>No course account was created. Every extra check was part of the challenge.</p></div>
    <div class="trophy-stage"><div class="trophy-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="trophy-ribbon"><span aria-hidden="true">✦</span> RARE ACHIEVEMENT UNLOCKED <span aria-hidden="true">✦</span></div>
      <div class="trophy-halo"><svg class="trophy-laurel" viewBox="0 0 240 240" aria-hidden="true"><g fill="none" stroke="#d3a04a" stroke-width="2.5"><path d="M74 202C20 176 17 98 67 46"/><path d="M166 202c54-26 57-104 7-156"/></g><g fill="#d9aa56"><ellipse cx="46" cy="171" rx="7" ry="16" transform="rotate(-39 46 171)"/><ellipse cx="29" cy="140" rx="7" ry="15" transform="rotate(-18 29 140)"/><ellipse cx="27" cy="108" rx="7" ry="15" transform="rotate(8 27 108)"/><ellipse cx="38" cy="78" rx="7" ry="15" transform="rotate(30 38 78)"/><ellipse cx="56" cy="54" rx="7" ry="15" transform="rotate(50 56 54)"/><ellipse cx="194" cy="171" rx="7" ry="16" transform="rotate(39 194 171)"/><ellipse cx="211" cy="140" rx="7" ry="15" transform="rotate(18 211 140)"/><ellipse cx="213" cy="108" rx="7" ry="15" transform="rotate(-8 213 108)"/><ellipse cx="202" cy="78" rx="7" ry="15" transform="rotate(-30 202 78)"/><ellipse cx="184" cy="54" rx="7" ry="15" transform="rotate(-50 184 54)"/></g></svg><svg class="trophy-art" viewBox="0 0 360 360" role="img" aria-label="Large engraved golden trophy">
        <defs><linearGradient id="cupGold" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#8d4918"/><stop offset=".12" stop-color="#d69632"/><stop offset=".28" stop-color="#ffe6a0"/><stop offset=".47" stop-color="#f5bf55"/><stop offset=".72" stop-color="#b86b22"/><stop offset=".9" stop-color="#ffe29a"/><stop offset="1" stop-color="#95501b"/></linearGradient><linearGradient id="rimGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff3c5"/><stop offset=".35" stop-color="#e8b95e"/><stop offset="1" stop-color="#98551e"/></linearGradient><linearGradient id="baseGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe6a2"/><stop offset=".5" stop-color="#d18b31"/><stop offset="1" stop-color="#783e1b"/></linearGradient></defs>
        <ellipse cx="180" cy="337" rx="137" ry="12" fill="#030d1d" opacity=".6"/>
        <path d="M108 91H62c-26 0-36 18-36 42 0 56 33 94 96 98l15-36c-42-1-72-19-72-60v-7h44Z" fill="url(#cupGold)" stroke="#f9d67c" stroke-width="3"/><path d="M252 91h46c26 0 36 18 36 42 0 56-33 94-96 98l-15-36c42-1 72-19 72-60v-7h-44Z" fill="url(#cupGold)" stroke="#f9d67c" stroke-width="3"/>
        <path d="M111 85h138l-9 100c-4 48-29 78-60 78s-56-30-60-78L111 85Z" fill="url(#cupGold)" stroke="#f8da8d" stroke-width="3"/><path d="M132 103h21l5 132c-19-12-29-33-32-62Z" fill="#fff0b6" opacity=".34"/><path d="M230 105h12l-9 78c-3 27-10 44-22 57 10-42 15-94 19-135Z" fill="#754017" opacity=".23"/>
        <rect x="96" y="68" width="168" height="23" rx="8" fill="url(#rimGold)" stroke="#ffeab1" stroke-width="2"/><path d="M107 96h146" stroke="#834514" stroke-width="3" opacity=".65"/>
        <circle cx="180" cy="161" r="40" fill="#874813" opacity=".5"/><circle cx="180" cy="158" r="39" fill="url(#rimGold)" stroke="#fff0ba" stroke-width="3"/><circle cx="180" cy="158" r="31" fill="#9d591d" stroke="#e8b75b" stroke-width="2"/><path d="m180 133 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2 7-15Z" fill="#fff4c7" stroke="#f4c66d" stroke-width="2"/>
        <path d="M147 217c9 22 19 34 33 40 14-6 24-18 33-40" fill="none" stroke="#ffdc81" stroke-width="3" opacity=".72"/><path d="M164 258h32v29h-32z" fill="url(#cupGold)" stroke="#eec476" stroke-width="2"/>
        <path d="M139 286h82l9 12H130l9-12Z" fill="url(#rimGold)" stroke="#ffe2a0" stroke-width="2"/><rect x="112" y="298" width="136" height="17" rx="4" fill="url(#baseGold)" stroke="#efc578" stroke-width="2"/><rect x="97" y="315" width="166" height="21" rx="5" fill="url(#baseGold)" stroke="#f4d58e" stroke-width="2"/><rect x="136" y="318" width="88" height="14" rx="2" fill="#55331f" stroke="#d6a652" stroke-width="1.5"/><text x="180" y="328" text-anchor="middle" fill="#f9d781" font-family="Georgia,serif" font-size="8" letter-spacing="2">PATIENCE</text>
      </svg></div><p class="trophy-overline">OFFICIALLY AWARDED</p><h3>For extraordinary persistence</h3>
      <p class="trophy-description">You survived the password rules, the confusing squares, the suspicious terms, and the final final confirmation.</p>
      <div class="trophy-stamp">PATIENCE LEVEL: LEGENDARY <span aria-hidden="true">✦</span></div>
      <div class="trophy-plaque"><span>THE ${currentYear} PATIENCE AWARD</span><strong>No shortcuts. No mercy. You made it.</strong></div>
    </div><p class="summary">No account was created. Your made-up email and password have been cleared from this tab.</p>
    <div class="prize-card"><span class="prize-kicker">YOUR ACTUAL PRIZE</span><h3>A pass you can keep.</h3><p>Download a personalised certificate, then visit the break room to pop some bubbles. You earned both.</p><div class="prize-actions"><button type="button" class="button button-primary" id="downloadPass">Download my pass ↓</button><button type="button" class="button button-secondary" id="openBreakRoom">Enter the break room →</button></div><small>Digital prizes, no account needed. Pass #${awardId}</small></div>
    <button type="button" class="button button-primary full" id="startAgain">Try the whole thing again</button>`);
  panel.querySelector('#downloadPass').addEventListener('click',downloadPatiencePass);
  panel.querySelector('#openBreakRoom').addEventListener('click',()=>moveTo('prize'));
  panel.querySelector('#startAgain').addEventListener('click',()=>moveTo('signup'));
}
let bubbleAudioContext;
function playBubblePop(index) {
  const AudioContextClass=window.AudioContext || window.webkitAudioContext;
  if(!AudioContextClass) return;
  try {
    bubbleAudioContext ||= new AudioContextClass();
    const context=bubbleAudioContext;
    if(context.state==='suspended') context.resume().catch(()=>{});
    const now=context.currentTime;
    const duration=.085;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let sample=0;sample<samples.length;sample++) samples[sample]=(Math.random()*2-1)*Math.pow(1-sample/samples.length,5);
    const noise=context.createBufferSource();
    const filter=context.createBiquadFilter();
    const noiseGain=context.createGain();
    noise.buffer=buffer;
    filter.type='lowpass';
    filter.frequency.value=950+(index%5)*110;
    noiseGain.gain.value=.24;
    noise.connect(filter).connect(noiseGain).connect(context.destination);
    noise.start(now);
    noise.onended=()=>{noise.disconnect();filter.disconnect();noiseGain.disconnect();};
    const tone=context.createOscillator();
    const toneGain=context.createGain();
    tone.type='sine';
    tone.frequency.setValueAtTime(190+(index%4)*12,now);
    tone.frequency.exponentialRampToValueAtTime(85,now+duration);
    toneGain.gain.setValueAtTime(.11,now);
    toneGain.gain.exponentialRampToValueAtTime(.001,now+duration);
    tone.connect(toneGain).connect(context.destination);
    tone.start(now);
    tone.stop(now+duration);
    tone.onended=()=>{tone.disconnect();toneGain.disconnect();};
  } catch(error) {
    // Sound is a bonus; the bubble still pops if audio is unavailable.
  }
}
function renderPrize() {
  if(!awardId) return moveTo('signup');
  frame('The break room','No forms. No confirmation. Just something satisfying.',`
    <div class="break-room"><div class="break-room-head"><span>UNLIMITED BUBBLE WRAP</span><strong id="bubbleCount" aria-live="polite">0 / 24 popped</strong></div><div class="bubble-sheet" role="group" aria-label="Bubble wrap">${Array.from({length:24},(_,index)=>`<button class="bubble" type="button" aria-label="Bubble ${index+1}" aria-pressed="false"></button>`).join('')}</div><p id="bubbleMessage">Go on. Pop every one.</p><div class="break-room-tools"><button type="button" class="link-button" id="resetBubbles">Fresh sheet, please</button><button type="button" class="sound-toggle" id="toggleSound" aria-pressed="true">Sound on</button></div></div>
    <div class="break-actions"><button type="button" class="button button-primary" id="downloadAgain">Download my Patience Pass ↓</button><button type="button" class="button button-secondary" id="backToTrophy">Back to trophy</button></div>`);
  let popped=0;
  let soundOn=true;
  const bubbles=[...panel.querySelectorAll('.bubble')];
  bubbles.forEach((bubble,index)=>bubble.addEventListener('click',()=>{
    if(bubble.classList.contains('popped')) return;
    bubble.classList.add('popped');
    bubble.setAttribute('aria-pressed','true');
    if(soundOn) playBubblePop(index);
    popped++;
    panel.querySelector('#bubbleCount').textContent=`${popped} / 24 popped`;
    if(popped===24) panel.querySelector('#bubbleMessage').textContent='Beautiful. The internet can be nice sometimes.';
  }));
  panel.querySelector('#resetBubbles').addEventListener('click',()=>{
    bubbles.forEach(bubble=>{bubble.classList.remove('popped');bubble.setAttribute('aria-pressed','false');});
    popped=0;
    panel.querySelector('#bubbleCount').textContent='0 / 24 popped';
    panel.querySelector('#bubbleMessage').textContent='A fresh sheet. No waiting required.';
  });
  panel.querySelector('#toggleSound').addEventListener('click',event=>{
    soundOn=!soundOn;
    event.currentTarget.setAttribute('aria-pressed',String(soundOn));
    event.currentTarget.textContent=soundOn?'Sound on':'Sound off';
  });
  panel.querySelector('#downloadAgain').addEventListener('click',downloadPatiencePass);
  panel.querySelector('#backToTrophy').addEventListener('click',()=>moveTo('success'));
}
function renderLogin() {
  frame('Sign in to your planning space','Use preview details only. No real account is connected.',`
    <form id="loginForm"><div class="field"><label for="loginEmail">Email address</label><input type="email" id="loginEmail" placeholder="you@example.com" autocomplete="off" required></div><div class="field"><label for="loginPassword">Password</label><input type="password" id="loginPassword" placeholder="Made-up password only" autocomplete="off" required></div><p class="demo-hint">Preview only. Never enter a password from a real account.</p><p class="form-notice" aria-live="polite"></p><button class="button button-primary full" type="submit">Sign in</button></form><p class="helper">New here? <button type="button" class="link-button" id="backToSignup">Create a planning space</button></p>`);
  panel.querySelector('#loginForm').addEventListener('submit',event=>{event.preventDefault();panel.querySelector('#loginPassword').value='';notice('Sign-in is unavailable in this preview. Create a planning space to try the setup.','info');});
  panel.querySelector('#backToSignup').addEventListener('click',()=>moveTo('signup'));
}
const studyAreas = [
  {code:'IT',name:'Information technology',description:'Software, data and computing pathways',keywords:'it technology computing software data cyber'},
  {code:'HE',name:'Health & nursing',description:'Health sciences and care professions',keywords:'health nursing medicine care'},
  {code:'BU',name:'Business & commerce',description:'Management, finance and marketing',keywords:'business commerce management finance marketing'},
  {code:'EN',name:'Engineering',description:'Design, build and solve practical problems',keywords:'engineering design construction'},
  {code:'ED',name:'Education',description:'Teaching and learning pathways',keywords:'education teaching school'},
  {code:'CA',name:'Creative arts',description:'Design, media and creative practice',keywords:'creative arts design media'}
];
function paintStudyAreas(query='') {
  const results=document.querySelector('#courseResults');
  const term=query.trim().toLowerCase();
  const matches=studyAreas.map((area,index)=>({...area,index})).filter(area=>!term||`${area.name} ${area.keywords}`.toLowerCase().includes(term));
  const displayed=term?matches:matches.slice(0,3);
  results.innerHTML=displayed.length?displayed.map(area=>`<button type="button" class="preview-row" data-area="${area.index}" aria-label="Save ${area.name} to a planning space"><span class="course-icon">${area.code}</span><span><strong>${area.name}</strong><small>${area.description}</small></span><span class="preview-arrow" aria-hidden="true">→</span></button>`).join(''):'<p class="empty-results">No sample study area matched. Try a broader search.</p>';
  results.querySelectorAll('[data-area]').forEach(button=>button.addEventListener('click',()=>{
    results.querySelectorAll('.preview-row').forEach(row=>row.classList.remove('is-selected'));
    button.classList.add('is-selected');
    const area=studyAreas[Number(button.dataset.area)];
    const notice=document.querySelector('#selectionNotice');
    notice.textContent=`Create your planning space to keep ${area.name} on your shortlist.`;
    notice.hidden=false;
    if(scene==='signup'||scene==='login') document.querySelector('.form-section').scrollIntoView({behavior:'smooth',block:'start'});
  }));
}
function updateIdentity() {
  const revealed=scene==='success'||scene==='prize';
  document.body.classList.toggle('revealed',revealed);
  document.title=revealed?'You made it — mildly':'Sydney Course Finder | Your planning space';
  document.querySelector('link[rel="icon"]').href=revealed?'./mildly-favicon.svg':'./favicon.svg';
  document.querySelector('.brand').setAttribute('aria-label',revealed?'mildly home and restart':'Sydney Course Finder home and restart');
  document.querySelector('#brandName').textContent=revealed?'mildly':'Sydney Course Finder';
  document.querySelector('#workspaceLabel').textContent=revealed?'THE PATIENCE TEST':'COURSE PLANNING SPACE';
  document.querySelector('#welcomeTitle').textContent=revealed?'The longest way to absolutely nowhere.':'Find a Sydney course that fits.';
  document.querySelector('#welcomeDescription').textContent=revealed?'You survived the forms, the checks and every “one last thing.” Your patience deserves a prize.':'Explore study areas, compare your options and keep a shortlist. Fewer open tabs would be nice, wouldn’t it?';
  document.querySelector('#coursePreview').hidden=revealed;
  document.querySelector('#revealSide').hidden=!revealed;
  document.querySelector('#footerBrand').textContent=revealed?`© ${currentYear} mildly`:`© ${currentYear} Sydney Course Finder preview`;
  document.querySelector('#footerTagline').textContent=revealed?'Made for the mildly patient.':'Local preview · No account is created';
  document.querySelector('#helpButton').textContent=revealed?'About this demo':'About';
  document.querySelector('#coursesButton').textContent=revealed?'Start over':'Courses';
  document.querySelector('#footerHelp').textContent=revealed?'About this demo':'Privacy & preview';
  document.querySelector('#loginButton').textContent=revealed?'Start again':'Sign in';
  document.querySelector('#infoTitle').textContent=revealed?'About this demo':'About this preview';
  document.querySelector('#infoDescription').textContent=revealed?'This is a parody of online signup rituals. The course finder screen was a disguise for the challenge. No account was created, and your made-up email and password were cleared.':'This is a simulated planning space. Use a made-up email and password only. Your entries stay in this tab for the final confirmation and are then cleared; they are not sent to a server or used to create an account.';
}
function render() {
  updateIdentity();
  ({signup:renderSignup,captcha:renderCaptcha,username:renderUsername,code:renderCode,cookies:renderCookies,notifications:renderNotifications,survey:renderSurvey,terms:renderTerms,waiting:renderWaiting,quiz:renderQuiz,success:renderSuccess,prize:renderPrize,login:renderLogin})[scene]();
}
const dialog=document.querySelector('#infoDialog');
for(const id of ['helpButton','footerHelp']) document.getElementById(id).addEventListener('click',()=>dialog.showModal());
for(const id of ['closeDialog','dialogOkay']) document.getElementById(id).addEventListener('click',()=>dialog.close());
document.querySelector('#loginButton').addEventListener('click',()=>moveTo(scene==='success'||scene==='prize'?'signup':'login'));
document.querySelector('#coursesButton').addEventListener('click',()=>{
  if(scene==='success'||scene==='prize') return moveTo('signup');
  document.querySelector('#coursePreview').scrollIntoView({behavior:'smooth',block:'center'});
  document.querySelector('#courseQuery').focus({preventScroll:true});
});
document.querySelector('#courseSearchForm').addEventListener('submit',event=>{
  event.preventDefault();
  paintStudyAreas(document.querySelector('#courseQuery').value);
  document.querySelector('#selectionNotice').hidden=true;
});
document.querySelector('#courseQuery').addEventListener('search',()=>paintStudyAreas(document.querySelector('#courseQuery').value));
paintStudyAreas();
render();
refreshDailyDeenReference();
