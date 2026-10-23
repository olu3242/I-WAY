import {test,expect,signIn,axeAccessibility} from './workspace.mjs';
const nav=async page=>{await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('button',{name:'Create load',exact:true}).click();};
async function fillLoad(page){for(const [label,value] of Object.entries({'Load reference':'ILL-BOUNDARY','Customer / broker':'Illustrative customer','Commodity':'Illustrative cargo','Pickup location':'Illustrative origin','Delivery location':'Illustrative destination'}))await page.getByLabel(label,{exact:true}).fill(value);}

test('load form numeric boundaries block invalid submissions and duplicate valid submits persist once',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await nav(page);await fillLoad(page);let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/ops/commands')&&r.method()==='POST')requests++;});
 const weight=page.getByLabel('Weight (lb)',{exact:true});
 for(const value of ['','0','-1','200001','1.5']){await weight.fill(value);await page.getByRole('button',{name:'Create draft load'}).click();expect(await weight.evaluate(el=>el.validity.valid)).toBe(false);expect(requests).toBe(0);}
 await weight.fill('200000');expect(await weight.evaluate(el=>el.validity.valid)).toBe(true);await weight.fill('1');
 await page.locator('#create-load').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await expect(page.locator('h1')).toHaveText('ILL-BOUNDARY');
 expect(workspace.store.list('load',workspace.manager.tenantId).filter(l=>l.reference==='ILL-BOUNDARY')).toHaveLength(1);await axeAccessibility(page,'boundary-load-created');
});

test('invalid chronology and whitespace preserve input and recover into a valid shipment',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await nav(page);await fillLoad(page);
 await page.getByLabel('Customer / broker',{exact:true}).fill('   ');await page.getByRole('button',{name:'Create draft load'}).click();await expect(page.getByRole('alert')).toBeFocused();expect(workspace.store.list('load',workspace.manager.tenantId)).toHaveLength(0);
 await page.getByLabel('Customer / broker',{exact:true}).fill('Illustrative corrected customer');await page.getByLabel('Pickup time (UTC)',{exact:true}).fill('2026-12-02T12:00');await page.getByLabel('Delivery time (UTC)',{exact:true}).fill('2026-12-01T12:00');await page.getByRole('button',{name:'Create draft load'}).click();await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByLabel('Load reference')).toHaveValue('ILL-BOUNDARY');expect(workspace.store.list('load',workspace.manager.tenantId)).toHaveLength(0);
 await page.getByLabel('Delivery time (UTC)',{exact:true}).fill('2026-12-03T12:00');await page.getByRole('button',{name:'Create draft load'}).click();await expect(page.locator('h1')).toHaveText('ILL-BOUNDARY');
});

test('administration rejects malformed inputs and suppresses concurrent duplicate saves',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await page.goto(workspace.baseURL+'/admin');await expect(page.locator('#notice')).toHaveText('Ready');
 await page.getByLabel('Currency',{exact:true}).fill('usd');expect(await page.getByLabel('Currency',{exact:true}).evaluate(el=>el.validity.valid)).toBe(false);await page.getByLabel('Currency',{exact:true}).fill('USD');
 await page.getByLabel('Time zone',{exact:true}).fill('Illustrative/Invalid');await page.getByRole('button',{name:'Save company settings'}).click();await expect(page.getByRole('alert')).toHaveText('INVALID_INPUT');await expect(page.getByLabel('Time zone',{exact:true})).toHaveValue('Illustrative/Invalid');
 await page.getByLabel('Time zone',{exact:true}).fill('America/Chicago');await page.getByRole('button',{name:'Save company settings'}).click();await expect(page.getByRole('status')).toHaveText('Company settings saved');
 await page.getByLabel('Record identifier').fill('boundary');await page.getByLabel('Configuration JSON').fill('{');await page.getByRole('button',{name:'Save configuration',exact:true}).click();await expect(page.getByRole('alert')).toBeFocused();
 await page.getByLabel('Configuration JSON').fill('{"name":"boundary","grants":[],"denials":[]}');
 let release,requests=0;const gate=new Promise(resolve=>release=resolve);await page.route('**/api/ops/admin/items',async route=>{if(route.request().method()==='POST'){requests++;await gate;}await route.continue();});
 try{await page.getByRole('button',{name:'Save configuration',exact:true}).click();await expect.poll(()=>requests).toBe(1);await expect(page.getByRole('button',{name:'Save configuration',exact:true})).toBeDisabled();await page.locator('#editor').evaluate(form=>form.requestSubmit());}finally{release();}
 await expect(page.getByRole('status')).toHaveText('Configuration saved');expect(requests).toBe(1);await expect(page.getByLabel('Expected version')).toHaveValue('1');expect(workspace.store.db.prepare("SELECT count(*) AS n FROM organization_admin_audit WHERE kind='permission-set'").get().n).toBe(1);
});

test('keyboard-triggered native cancellation restores control focus and records no void',async({page,workspace})=>{
 const load=workspace.createLoad();await signIn(page,workspace,workspace.manager);await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();
 const button=page.getByRole('button',{name:'Void load'});await button.focus();let message;page.once('dialog',async dialog=>{message=dialog.message();await dialog.dismiss();});await button.press('Enter');expect(message).toContain('Reason');await expect(button).toBeEnabled();await expect(button).toBeFocused();expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('draft');await axeAccessibility(page,'keyboard-native-cancel');
});
