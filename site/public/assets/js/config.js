/* Public site runtime configuration. Everything here ships to the browser: never put secrets, internal URLs or internal product details in this file. */
window.IWAY_CONFIG = {
  env: "preview",                 // "preview" | "production". Preview shows honest "nothing is sent" messaging.
  earlyAccessEndpoint: "",        // HTTPS URL that accepts JSON POST. Leave empty until a sign-up service is approved and connected.
  supportEmail: "",               // Public support address. Leave empty until approved.
  portals: { driver: "", carrier: "", fleet: "" }, // Sign-in URLs. Leave empty until each sign-in is live.
  analytics: { enabled: true, debug: true }        // Emits events to window.dataLayer / CustomEvent only. No cookies, no PII.
};
