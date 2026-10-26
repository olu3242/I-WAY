import {readFileSync} from 'node:fs';
// Use the approved artwork and font without modifying the assets.
export const uatLogo=readFileSync(new URL('../apps/operations/i-way-logo.svg',import.meta.url),'utf8');
export const uatFont=readFileSync(new URL('../apps/operations/InterVariable.woff2',import.meta.url));
export const uatStyles=`
@font-face{font-family:Inter;src:url('/uat/font.woff2') format('woff2');font-weight:100 900;font-display:swap}
*{box-sizing:border-box} [hidden]{display:none!important}
body{margin:0;background:#F5F8FC;color:#111827;font-family:Inter,system-ui,sans-serif;line-height:1.6}
.shell{min-height:100svh;max-width:1200px;margin:auto;padding:40px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}
.brand img{display:block;width:160px;height:auto;background:white;border-radius:12px;padding:12px}
.badge{font-size:12px;font-weight:700;color:#092448;background:#e7edf5;border:1px solid #cdd9e7;border-radius:100px;padding:6px 12px;letter-spacing:.08em}
.layout{display:grid;grid-template-columns:1fr 1fr;background:white;border:1px solid #dce4ef;border-radius:20px;overflow:hidden;box-shadow:0 20px 64px #0924480c}
.intro{padding:56px 44px;background:#092448;color:white;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:0 0 16px}
.intro h2{font-size:clamp(30px,3.4vw,44px);line-height:1.15;letter-spacing:-.04em;margin:0 0 24px;max-width:9em}
.intro p:not(.eyebrow){color:#dae6f5;max-width:28em;margin:0}
.accent{width:48px;height:5px;background:#FF681C;border-radius:8px;margin-bottom:28px}
.panel{padding:44px;min-width:0}
h1{font-size:28px;line-height:1.2;letter-spacing:-.03em;color:#092448;margin:0 0 12px}
.description,.help{color:#475569;font-size:14px;margin:0 0 28px}
form{display:grid;gap:20px}label{display:grid;gap:8px;font-size:14px;font-weight:600;color:#092448}
input{width:100%;min-width:0;min-height:48px;border:1px solid #94a3b8;border-radius:12px;background:white;padding:12px 14px;font:inherit;color:#111827}
button{min-height:48px;border:1px solid transparent;border-radius:12px;padding:12px 16px;background:#FF681C;color:#092448;font:inherit;font-weight:700;cursor:pointer;width:100%}
button:hover{filter:brightness(.96)}button:disabled{opacity:.65;cursor:wait}
button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #1261F3;outline-offset:3px}
.secondary{background:white;border-color:#94a3b8;color:#092448}
.divider{display:flex;align-items:center;gap:12px;color:#475569;font-size:12px;margin:24px 0 16px}
.divider:before,.divider:after{content:'';height:1px;flex:1;background:#dce4ef}
.hint{color:#475569;font-size:12px;margin:8px 0 0}
#status{font-size:14px;color:#092448;overflow-wrap:anywhere;margin:20px 0 0}#status:empty{display:none}
.help{border-top:1px solid #dce4ef;margin:24px 0 0;padding-top:20px;font-size:12px}
.back{display:inline-flex;align-items:center;min-height:44px;margin-top:12px;color:#1261F3;font-size:14px;font-weight:600}
footer{color:#475569;font-size:12px;margin-top:20px;text-align:center}
@media(max-width:760px){.shell{padding:24px 16px;justify-content:flex-start}.brand{margin-bottom:20px}.layout{grid-template-columns:1fr}.intro{padding:28px}.intro h2{font-size:28px;max-width:none;margin-bottom:12px}.intro .accent{margin-bottom:16px}.intro p:not(.eyebrow){font-size:14px}.panel{padding:28px}.eyebrow{margin-bottom:8px}}
@media(max-width:380px){.shell{padding:16px 12px}.panel,.intro{padding:24px 20px}.brand img{width:140px}.badge{font-size:10px;padding:6px 10px}h1{font-size:25px}}
`;
export function uatPage(setup){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${setup?'Set your password':'Sign in'} | I-WAY UAT</title><link rel="stylesheet" href="/uat/styles.css"></head>
<body><div class="shell"><header class="brand"><img src="/uat/brand.svg" alt="I-way" width="160"><span class="badge">UAT WORKSPACE</span></header>
<main class="layout"><section class="intro" aria-labelledby="welcome"><div class="accent" aria-hidden="true"></div><p class="eyebrow">Logistics made simpler</p><h2 id="welcome">Move Smarter.<br>Go Further.</h2><p>Your I-WAY testing workspace. Sign in with your assigned account to get started.</p></section>
<section class="panel" aria-labelledby="title"><h1 id="title">${setup?'Set your I-WAY password':'Welcome to I-WAY'}</h1><p class="description">${setup?'Create a password with at least 15 characters.':'Enter your email and password to access your workspace.'}</p>
<form id="credentials">${setup?'':'<label for="email">Email<input id="email" name="email" type="email" autocomplete="username" required></label>'}<label for="password">${setup?'New password':'Password'}<input id="password" name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" ${setup?'minlength="15"':''} maxlength="128" required></label><button>${setup?'Set password':'Sign in'}</button></form>
<form id="mfa" hidden><label for="code">Authenticator code<input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" aria-describedby="code-hint" required></label><p class="hint" id="code-hint">Enter the six-digit code from your authenticator app.</p><button>Verify</button></form>
${setup?'':'<div id="google-choice"><div class="divider">Other sign-in option</div><form action="/auth/login" method="post"><button class="secondary">Continue with Google</button></form><p class="hint">Only for accounts linked to Google by your administrator.</p></div>'}
<p id="status" role="status" aria-live="polite"></p><p class="help">Access is limited to approved testers. For help with access or password recovery, contact your UAT administrator.</p><a class="back" href="/uat/login">Return to sign in</a></section></main><footer>I-WAY · User acceptance testing</footer></div><script src="/uat/client.js" defer></script></body></html>`;}
