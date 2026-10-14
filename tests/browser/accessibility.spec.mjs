import {test,expect,signIn,basicAccessibility,axeAccessibility} from './workspace.mjs';
import {password} from '../helpers/operations-fixture.mjs';

test('WCAG2.2AA carrier views reflow and keep keyboard navigation and forms usable',async({page,workspace})=>{
<<<<<<< HEAD
 // Full multi-view/persona journey includes repeated axe scans; assertion deadlines remain unchanged.
 test.setTimeout(180000);
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 await signIn(page,workspace,workspace.manager);
 workspace.assign();
 await page.reload();
 for(const width of [1440,320]){
  await page.setViewportSize({width,height:1000});
  const names=await page.locator('#nav button').allTextContents();
  for(const name of names){
   await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name,exact:true}).click();
   await expect(page.locator('h1')).toBeFocused();
   await basicAccessibility(page);
  }
 }
});

test('sign-in failure is announced and focused and recovers with keyboard input',async({page,workspace})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(workspace.baseURL+'/login');
 await axeAccessibility(page,'login-form');
 await page.getByLabel('Username',{exact:true}).fill(workspace.manager.username);
 await page.getByLabel('Password',{exact:true}).fill('illustrative incorrect password');
 await page.getByLabel('Password',{exact:true}).press('Enter');
 await expect(page.getByRole('alert')).toContainText('Sign-in failed.');
 await expect(page.getByRole('alert')).toBeFocused();
 await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('aria-describedby','message');
 await axeAccessibility(page,'login-error');
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByLabel('Password',{exact:true}).press('Enter');
 await expect(page).toHaveURL(workspace.baseURL+'/app');
 await expect(page.locator('#identity')).toContainText(workspace.manager.name);
});

test('fleet completes employment and equipment work and server errors remain recoverable',async({page,workspace})=>{
 await page.setViewportSize({width:390,height:844});
 await signIn(page,workspace,workspace.fleetUser);
 await page.getByRole('button',{name:'Workspace access',exact:true}).click();
 await page.getByLabel('Display name',{exact:true}).fill('Illustrative hired driver');
 await page.getByLabel('Username',{exact:true}).fill('fleet-hire@illustrative.invalid');
 await page.getByLabel('Initial local password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Create driver account',exact:true}).click();
 await expect(page.locator('#view')).toContainText('Illustrative hired driver');
 await expect(page.locator('#view')).not.toContainText(workspace.driver.name);
 await page.getByRole('button',{name:'People & equipment',exact:true}).click();
 await page.getByLabel('Vehicle name / unit',{exact:true}).fill('Illustrative fleet equipment');
 await page.getByLabel('Capacity (lb)',{exact:true}).fill('40000');
 let lostResponse=false;
 await page.route('**/api/ops/commands',async route=>{
  if(!lostResponse&&route.request().postDataJSON()?.action==='vehicle:create'){
   await route.fetch();lostResponse=true;await route.abort('failed');
  }else await route.continue();
 });
 await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Failed to fetch');
 await expect(page.getByRole('alert')).toBeFocused();
 expect(workspace.store.list('vehicle',workspace.manager.tenantId).filter(v=>v.name==='Illustrative fleet equipment')).toHaveLength(1);
 await expect(page.getByLabel('Vehicle name / unit',{exact:true})).toHaveValue('Illustrative fleet equipment');
 await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
 await expect(page.getByRole('status')).toBeFocused();
 expect(workspace.store.list('vehicle',workspace.manager.tenantId).filter(v=>v.name==='Illustrative fleet equipment')).toHaveLength(1);
 const own=workspace.store.list('vehicle',workspace.manager.tenantId).find(v=>v.name==='Illustrative fleet equipment');
 expect(own.fleetId).toBe(workspace.fleet.id);
 expect(own.approved).toBe(false);
 await page.locator('.inline-record').filter({hasText:'Illustrative fleet equipment'}).getByRole('button',{name:'Manage',exact:true}).click();
 await expect(page.locator('h1')).toBeFocused();
 await page.getByLabel('Maintenance',{exact:true}).selectOption('out_of_service');
 await page.getByLabel('Reason for update',{exact:true}).fill('Illustrative maintenance hold');
 // A concurrent owner update makes the browser version stale, without bypassing the real API.
 workspace.command(workspace.fleetUser,'vehicle:update',own,{available:false,reason:'Illustrative parallel fleet action'});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Refresh');
 await expect(page.getByRole('alert')).toBeFocused();
 await expect(page.getByLabel('Reason for update',{exact:true})).toHaveValue('Illustrative maintenance hold');
 await axeAccessibility(page,'fleet-stale-error');
 await page.reload();
 await page.getByRole('button',{name:'People & equipment',exact:true}).click();
 await page.locator('.inline-record').filter({hasText:'Illustrative fleet equipment'}).getByRole('button',{name:'Manage',exact:true}).click();
 await page.getByLabel('Maintenance',{exact:true}).selectOption('out_of_service');
 await page.getByLabel('Reason for update',{exact:true}).fill('Illustrative verified maintenance hold');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('status')).toBeFocused();
 expect(workspace.store.get('vehicle',own.id,workspace.manager.tenantId).maintenance).toBe('out_of_service');
 await page.getByRole('button',{name:'Workspace access',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept('Illustrative employment ended'));
 await page.getByRole('button',{name:'Deactivate account',exact:true}).click();
 await expect(page.locator('#view')).toContainText('inactive');
 const hired=workspace.store.db.prepare('SELECT data FROM users WHERE username=?').get('fleet-hire@illustrative.invalid');
 expect(JSON.parse(hired.data).active).toBe(false);
 await basicAccessibility(page);
});
