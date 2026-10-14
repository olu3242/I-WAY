import {defineConfig} from '@playwright/test';
// The browser suite owns disposable SQLite/HTTP fixtures; it never reads .env.local.
export default defineConfig({
 testDir:'./tests/browser',
 testMatch:'**/*.spec.mjs',
 fullyParallel:false,
 workers:1,
 timeout:60000,
 expect:{timeout:10000},
 retries:0,
 forbidOnly:!!process.env.CI,
 reporter:[['./tests/browser/evidence-reporter.mjs'],['list'],['html',{outputFolder:'dist/browser-report',open:'never'}]],
 outputDir:'dist/browser-results',
 use:{browserName:'chromium',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
});
